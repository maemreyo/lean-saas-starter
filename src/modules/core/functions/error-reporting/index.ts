/**
 * Central Error Reporting Endpoint
 * 
 * Provides centralized error reporting and logging for the entire application.
 * Uses all Layer 1 & 2 utilities for comprehensive error management.
 * 
 * Features:
 * - Error collection và aggregation
 * - Error categorization và priority
 * - Rate limiting to prevent spam
 * - Authentication và authorization
 * - Audit logging của error reports
 * - Integration với monitoring systems
 */

import { 
  ApiError, 
  ValidationError, 
  DatabaseError,
  ErrorCode,
  errorUtils,
  formatErrorResponse 
} from '@/errors';
import { logger } from '@/logging';
import { database } from '@/database';
import { auth, AuthStrategy } from '@/auth-middleware';
import { validation } from '@/validation';
import { rateLimit } from '@/rate-limiting';
import { security } from '@/security';
import { cache } from '@/cache';
import { z } from 'zod';

/**
 * Error report schema
 */
const ErrorReportSchema = z.object({
  // Error details
  message: z.string().min(1).max(1000),
  errorCode: z.string().optional(),
  stack: z.string().optional(),
  
  // Context information
  url: z.string().url().optional(),
  userAgent: z.string().max(500).optional(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  
  // Application context
  module: z.string().min(1).max(50),
  function: z.string().min(1).max(100).optional(),
  version: z.string().optional(),
  environment: z.enum(['development', 'test', 'production']).optional(),
  
  // Error metadata
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category: z.enum(['frontend', 'backend', 'api', 'database', 'network', 'security', 'performance']).default('backend'),
  tags: z.array(z.string()).max(10).default([]),
  
  // Additional data
  additionalData: z.record(z.any()).optional(),
  fingerprint: z.string().optional(), // For grouping similar errors
  
  // Client information
  timestamp: z.string().datetime().optional(),
  browserInfo: z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    platform: z.string().optional()
  }).optional()
});

type ErrorReport = z.infer<typeof ErrorReportSchema>;

/**
 * Error aggregation result
 */
interface ErrorAggregation {
  fingerprint: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  message: string;
  module: string;
  severity: string;
  category: string;
}

/**
 * Error statistics
 */
interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByModule: Record<string, number>;
  recentErrorRate: number;
  topErrors: ErrorAggregation[];
}

/**
 * Error reporting service
 */
class ErrorReportingService {
  private helper = database.createQueryHelper(database.getServiceClient(), {
    module: 'core',
    operation: 'error-reporting'
  });

  /**
   * Report an error
   */
  async reportError(errorReport: ErrorReport, context: any = {}): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Generate fingerprint for error grouping
      const fingerprint = this.generateFingerprint(errorReport);
      
      // Store error report
      const errorId = await this.storeErrorReport({
        ...errorReport,
        fingerprint
      }, context);

      // Update error aggregation
      await this.updateErrorAggregation(fingerprint, errorReport);

      // Create audit log
      await this.helper.rpc('create_audit_log', {
        p_event_type: 'error_reported',
        p_event_action: 'create',
        p_event_category: 'system',
        p_actor_type: context.userId ? 'user' : 'system',
        p_actor_id: context.userId || null,
        p_actor_ip_address: context.ipAddress || null,
        p_target_type: 'error_report',
        p_target_id: errorId,
        p_event_data: JSON.stringify({
          fingerprint,
          severity: errorReport.severity,
          category: errorReport.category,
          module: errorReport.module
        }),
        p_event_result: 'success',
        p_event_message: `Error reported: ${errorReport.message.substring(0, 100)}`,
        p_module_name: 'core',
        p_function_name: 'error_reporting'
      });

      // Log error for monitoring
      logger.error('Error reported', {
        errorId,
        fingerprint,
        severity: errorReport.severity,
        category: errorReport.category,
        module: errorReport.module,
        message: errorReport.message,
        duration: Date.now() - startTime
      });

      // Check if this is a critical error and needs immediate attention
      if (errorReport.severity === 'critical') {
        await this.handleCriticalError(errorReport, errorId);
      }

      return errorId;

    } catch (error) {
      logger.error('Failed to report error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        originalError: errorReport.message,
        duration: Date.now() - startTime
      });
      
      throw new DatabaseError('Failed to store error report', {
        context: { originalError: errorReport, error }
      });
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(timeRange: string = '24h'): Promise<ErrorStats> {
    const cacheKey = `error_stats:${timeRange}`;
    
    // Try cache first
    const cached = await cache.get<ErrorStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Calculate time range
      const now = new Date();
      const timeRangeMs = this.parseTimeRange(timeRange);
      const since = new Date(now.getTime() - timeRangeMs);

      // Get total error count
      const totalResult = await this.helper.rpc('exec', {
        sql: 'SELECT COUNT(*) as total FROM error_reports WHERE created_at >= $1',
        params: [since.toISOString()]
      });

      const totalErrors = totalResult.data?.[0]?.total || 0;

      // Get errors by category
      const categoryResult = await this.helper.rpc('exec', {
        sql: `
          SELECT category, COUNT(*) as count 
          FROM error_reports 
          WHERE created_at >= $1 
          GROUP BY category 
          ORDER BY count DESC
        `,
        params: [since.toISOString()]
      });

      // Get errors by severity
      const severityResult = await this.helper.rpc('exec', {
        sql: `
          SELECT severity, COUNT(*) as count 
          FROM error_reports 
          WHERE created_at >= $1 
          GROUP BY severity 
          ORDER BY count DESC
        `,
        params: [since.toISOString()]
      });

      // Get errors by module
      const moduleResult = await this.helper.rpc('exec', {
        sql: `
          SELECT module, COUNT(*) as count 
          FROM error_reports 
          WHERE created_at >= $1 
          GROUP BY module 
          ORDER BY count DESC
        `,
        params: [since.toISOString()]
      });

      // Get top error fingerprints
      const topErrorsResult = await this.helper.rpc('exec', {
        sql: `
          SELECT 
            fingerprint,
            COUNT(*) as count,
            MIN(created_at) as first_seen,
            MAX(created_at) as last_seen,
            message,
            module,
            severity,
            category
          FROM error_reports 
          WHERE created_at >= $1 
          GROUP BY fingerprint, message, module, severity, category
          ORDER BY count DESC 
          LIMIT 10
        `,
        params: [since.toISOString()]
      });

      // Calculate recent error rate (errors per hour)
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const recentResult = await this.helper.rpc('exec', {
        sql: 'SELECT COUNT(*) as recent FROM error_reports WHERE created_at >= $1',
        params: [hourAgo.toISOString()]
      });

      const recentErrorRate = recentResult.data?.[0]?.recent || 0;

      const stats: ErrorStats = {
        totalErrors,
        errorsByCategory: this.arrayToRecord(categoryResult.data || []),
        errorsBySeverity: this.arrayToRecord(severityResult.data || []),
        errorsByModule: this.arrayToRecord(moduleResult.data || []),
        recentErrorRate,
        topErrors: (topErrorsResult.data || []).map((row: any) => ({
          fingerprint: row.fingerprint,
          count: row.count,
          firstSeen: new Date(row.first_seen),
          lastSeen: new Date(row.last_seen),
          message: row.message,
          module: row.module,
          severity: row.severity,
          category: row.category
        }))
      };

      // Cache results for 5 minutes
      await cache.set(cacheKey, stats, 300);

      return stats;

    } catch (error) {
      logger.error('Failed to get error statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timeRange
      });
      
      throw new DatabaseError('Failed to retrieve error statistics', {
        context: { timeRange, error }
      });
    }
  }

  /**
   * Get error details by ID
   */
  async getErrorDetails(errorId: string): Promise<any> {
    const result = await this.helper.select('error_reports', {
      filters: { id: errorId },
      limit: 1
    });

    if (result.error) {
      throw new DatabaseError('Failed to get error details', {
        context: { errorId, error: result.error }
      });
    }

    if (!result.data || result.data.length === 0) {
      throw new ValidationError('Error report not found', {
        context: { errorId }
      });
    }

    return result.data[0];
  }

  /**
   * Store error report in database
   */
  private async storeErrorReport(errorReport: ErrorReport, context: any): Promise<string> {
    const errorData = {
      message: errorReport.message,
      error_code: errorReport.errorCode,
      stack_trace: errorReport.stack,
      url: errorReport.url,
      user_agent: errorReport.userAgent,
      user_id: errorReport.userId,
      session_id: errorReport.sessionId,
      module: errorReport.module,
      function_name: errorReport.function,
      version: errorReport.version,
      environment: errorReport.environment || 'production',
      severity: errorReport.severity,
      category: errorReport.category,
      tags: JSON.stringify(errorReport.tags),
      additional_data: JSON.stringify(errorReport.additionalData || {}),
      fingerprint: errorReport.fingerprint,
      ip_address: context.ipAddress,
      browser_info: JSON.stringify(errorReport.browserInfo || {}),
      reported_at: errorReport.timestamp ? new Date(errorReport.timestamp) : new Date()
    };

    const result = await this.helper.insert('error_reports', errorData, {
      select: 'id'
    });

    if (result.error) {
      throw result.error;
    }

    return result.data.id;
  }

  /**
   * Generate fingerprint for error grouping
   */
  private generateFingerprint(errorReport: ErrorReport): string {
    // If fingerprint is provided, use it
    if (errorReport.fingerprint) {
      return errorReport.fingerprint;
    }

    // Generate fingerprint based on error characteristics
    const components = [
      errorReport.module,
      errorReport.function || '',
      errorReport.errorCode || '',
      this.normalizeMessage(errorReport.message)
    ].filter(Boolean);

    // Simple hash function for fingerprint
    const text = components.join(':');
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Normalize error message for fingerprinting
   */
  private normalizeMessage(message: string): string {
    return message
      .replace(/\d+/g, 'NUMBER') // Replace numbers
      .replace(/[a-f0-9-]{36}/g, 'UUID') // Replace UUIDs
      .replace(/[a-f0-9]{8,}/g, 'HASH') // Replace long hex strings
      .replace(/\s+/g, ' ') // Normalize whitespace
      .toLowerCase()
      .trim();
  }

  /**
   * Update error aggregation
   */
  private async updateErrorAggregation(fingerprint: string, errorReport: ErrorReport): Promise<void> {
    // Increment error count in aggregation table
    await this.helper.rpc('exec', {
      sql: `
        INSERT INTO error_aggregations (fingerprint, message, module, severity, category, count, first_seen, last_seen)
        VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())
        ON CONFLICT (fingerprint)
        DO UPDATE SET 
          count = error_aggregations.count + 1,
          last_seen = NOW()
      `,
      params: [
        fingerprint,
        errorReport.message,
        errorReport.module,
        errorReport.severity,
        errorReport.category
      ]
    });
  }

  /**
   * Handle critical error
   */
  private async handleCriticalError(errorReport: ErrorReport, errorId: string): Promise<void> {
    logger.error('CRITICAL ERROR REPORTED', {
      errorId,
      message: errorReport.message,
      module: errorReport.module,
      category: errorReport.category,
      timestamp: new Date().toISOString()
    });

    // Could integrate với external monitoring services here
    // e.g., Sentry, PagerDuty, Slack notifications
  }

  /**
   * Parse time range string to milliseconds
   */
  private parseTimeRange(timeRange: string): number {
    const match = timeRange.match(/^(\d+)([hdw])$/);
    if (!match) {
      return 24 * 60 * 60 * 1000; // Default to 24 hours
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
      case 'w': return num * 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Convert array of {category, count} to record
   */
  private arrayToRecord(data: any[]): Record<string, number> {
    return data.reduce((acc, item) => {
      acc[item.category || item.severity || item.module] = item.count;
      return acc;
    }, {});
  }
}

/**
 * Error reporting endpoint handler
 */
export default async function handler(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    // Apply security headers
    const securityHeaders = security.createSecurityHeaders();

    // Apply rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    const rateLimitResult = await rateLimit.checkLimit(
      `error-reporting:${clientIP}`,
      30, // 30 requests per minute
      60000
    );

    if (!rateLimitResult) {
      return new Response(
        JSON.stringify(formatErrorResponse(new ApiError('Rate limit exceeded', {
          code: ErrorCode.RATE_LIMIT_EXCEEDED
        }))),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...securityHeaders
          }
        }
      );
    }

    const method = request.method;
    const url = new URL(request.url);

    // Handle different HTTP methods
    switch (method) {
      case 'POST':
        return await handleErrorReport(request, securityHeaders);
      
      case 'GET':
        return await handleGetErrorStats(request, url, securityHeaders);
      
      case 'OPTIONS':
        return new Response(null, {
          status: 200,
          headers: {
            'Allow': 'POST, GET, OPTIONS',
            ...securityHeaders
          }
        });

      default:
        return new Response(
          JSON.stringify(formatErrorResponse(new ApiError('Method not allowed', {
            code: ErrorCode.METHOD_NOT_ALLOWED
          }))),
          {
            status: 405,
            headers: {
              'Content-Type': 'application/json',
              'Allow': 'POST, GET, OPTIONS',
              ...securityHeaders
            }
          }
        );
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Error reporting endpoint failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      method: request.method,
      url: request.url,
      duration
    });

    return new Response(
      JSON.stringify(formatErrorResponse(new ApiError('Internal server error', {
        code: ErrorCode.INTERNAL_ERROR
      }))),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...security.createSecurityHeaders()
        }
      }
    );
  }
}

/**
 * Handle error report submission
 */
async function handleErrorReport(request: Request, securityHeaders: Record<string, string>): Promise<Response> {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate error report
    const validationResult = validation.validateData(ErrorReportSchema, body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify(formatErrorResponse(new ValidationError('Invalid error report data', {
          context: { errors: validationResult.errors }
        }))),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...securityHeaders
          }
        }
      );
    }

    // Extract context from request
    const context = {
      ipAddress: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
      userId: validationResult.data.userId
    };

    // Report error
    const errorReportingService = new ErrorReportingService();
    const errorId = await errorReportingService.reportError(validationResult.data, context);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          errorId,
          message: 'Error report submitted successfully'
        }
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          ...securityHeaders
        }
      }
    );

  } catch (error) {
    if (error instanceof ValidationError) {
      return new Response(
        JSON.stringify(formatErrorResponse(error)),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...securityHeaders
          }
        }
      );
    }

    return new Response(
      JSON.stringify(formatErrorResponse(new ApiError('Failed to process error report', {
        code: ErrorCode.INTERNAL_ERROR
      }))),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...securityHeaders
        }
      }
    );
  }
}

/**
 * Handle error statistics request
 */
async function handleGetErrorStats(
  request: Request, 
  url: URL, 
  securityHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Authenticate request (require API key or JWT)
    const middleware = auth.createMiddleware({
      strategy: AuthStrategy.JWT_OR_API_KEY,
      permissions: [
        { action: 'read', resource: 'error-stats' }
      ],
      audit: { logAccess: true }
    });

    const authResult = await middleware(request);

    // Get query parameters
    const timeRange = url.searchParams.get('timeRange') || '24h';
    const errorId = url.searchParams.get('errorId');

    const errorReportingService = new ErrorReportingService();

    if (errorId) {
      // Get specific error details
      const errorDetails = await errorReportingService.getErrorDetails(errorId);
      
      return new Response(
        JSON.stringify({
          success: true,
          data: errorDetails
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...securityHeaders
          }
        }
      );
    } else {
      // Get error statistics
      const stats = await errorReportingService.getErrorStats(timeRange);
      
      return new Response(
        JSON.stringify({
          success: true,
          data: stats
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...securityHeaders
          }
        }
      );
    }

  } catch (error) {
    if (error instanceof ApiError) {
      return new Response(
        JSON.stringify(formatErrorResponse(error)),
        {
          status: error.statusCode || 500,
          headers: {
            'Content-Type': 'application/json',
            ...securityHeaders
          }
        }
      );
    }

    return new Response(
      JSON.stringify(formatErrorResponse(new ApiError('Failed to get error statistics', {
        code: ErrorCode.INTERNAL_ERROR
      }))),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...securityHeaders
        }
      }
    );
  }
}