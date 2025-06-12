import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
    environment: process.env.NODE_ENV,
    services: {
      database: 'unknown',
      auth: 'unknown',
      storage: 'unknown'
    }
  };

  try {
    // Check Supabase connection
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Test database connection
    const { error: dbError } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    healthCheck.services.database = dbError ? 'unhealthy' : 'healthy';

    // Test auth service
    const { error: authError } = await supabase.auth.getSession();
    healthCheck.services.auth = authError ? 'unhealthy' : 'healthy';

    // Test storage service (simple list check)
    const { error: storageError } = await supabase.storage.listBuckets();
    healthCheck.services.storage = storageError ? 'unhealthy' : 'healthy';

    // Determine overall health
    const hasUnhealthyService = Object.values(healthCheck.services).includes('unhealthy');
    healthCheck.status = hasUnhealthyService ? 'degraded' : 'healthy';

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

    return NextResponse.json(healthCheck, { status: statusCode });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      ...healthCheck,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}

// Basic liveness probe
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}