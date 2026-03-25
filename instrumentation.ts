export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initSchema } = await import('./lib/db');
      await initSchema();
      console.log('[Instrumentation] Database schema ready');
    } catch (err) {
      console.error('[Instrumentation] Database init fejl:', err);
    }

    try {
      const { registerCrons } = await import('./agents/runner');
      registerCrons();
      console.log('[Instrumentation] Cron jobs registreret');
    } catch (err) {
      console.error('[Instrumentation] Cron registrering fejl:', err);
    }
  }
}
