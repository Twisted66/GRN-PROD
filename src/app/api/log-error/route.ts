import { NextRequest, NextResponse } from 'next/server';
import { reportError } from '@/lib/sentry';

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();
    
    // Validate required fields
    if (!errorData.message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Create error object
    const error = new Error(errorData.message);
    error.stack = errorData.stack;
    
    // Extract context
    const context = {
      category: errorData.category || 'unknown',
      errorId: errorData.id,
      statusCode: errorData.statusCode,
      userAgent: errorData.userAgent || request.headers.get('user-agent'),
      url: errorData.url,
      timestamp: errorData.timestamp,
      userId: errorData.userId,
      context: errorData.context
    };
    
    // Log to external service (Sentry)
    reportError(error, context);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Client Error:', {
        error: errorData,
        context
      });
    }
    
    // Store in database for analytics (optional)
    // await storeErrorLog(errorData, context);
    
    return NextResponse.json({ 
      success: true, 
      errorId: errorData.id 
    });
    
  } catch (error) {
    console.error('Error logging failed:', error);
    
    // Don't throw - error logging should never break the app
    return NextResponse.json(
      { error: 'Logging failed' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy',
    service: 'error-logging',
    timestamp: new Date().toISOString()
  });
}