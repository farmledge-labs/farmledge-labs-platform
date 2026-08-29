import { env } from './config/env.js'
import app from './app.js'
import { startReconcileJob } from './jobs/reconcile.job.js'

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`)
  startReconcileJob()
})
