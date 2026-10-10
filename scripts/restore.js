#!/usr/bin/env node
/**
 * Detached restore helper script.
 *
 * This script is invoked by the server's `/api/restore` endpoint in a detached child
 * process. It stops the MangoDash service (managed by nssm), copies the selected
 * backup over the current installation, and then restarts the service.
 *
 * Running this script outside of the service is safe – it simply performs the
 * restoration steps and logs any errors to the service error log.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node restore.js <backup-folder-name>');
  process.exit(1);
}

const folder = process.argv[2];
const BACKUP_ROOT = path.join(__dirname, '..', 'Backup');
const NssmPath = path.join(__dirname, '..', 'tools', 'nssm.exe');
const src = path.join(BACKUP_ROOT, folder);
const dest = path.join(__dirname, '..'); // project root

// Helper to write to the shared service error log.
function logError(message, err) {
  const logPath = path.join(__dirname, '..', 'service_error.log');
  const time = new Date().toISOString();
  const entry = `[${time}] ${message}: ${err && err.stack ? err.stack : err}\n`;
  try {
    fs.appendFileSync(logPath, entry);
  } catch (_) {
    // If logging fails, there's not much we can do.
  }
}

(async () => {
  // Verify backup folder exists.
  try {
    const stat = await fs.promises.stat(src);
    if (!stat.isDirectory()) {
      logError('Backup folder not found', new Error('Not a directory'));
      process.exit(1);
    }
  } catch (e) {
    logError('Backup folder validation failed', e);
    process.exit(1);
  }

  // Stop the MangoDash service.
  try {
    execSync(`"${NssmPath}" stop MangoDash`);
  } catch (e) {
    // Service may already be stopped; ignore but log.
    logError('Stopping service failed (ignored)', e);
  }
  // Give the service a moment to fully terminate and release file locks.
  await new Promise(resolve => setTimeout(resolve, 2000));
  // If the service is not managed by nssm (e.g., running directly), the parent process may still be alive.
  // Attempt to terminate the parent process using its PID to release any file handles (especially the SQLite DB).
  if (process.ppid && process.ppid !== 0) {
    try {
      execSync(`taskkill /PID ${process.ppid} /F`);
    } catch (e) {
      logError('Failed to kill parent process (ignored)', e);
    }
    // Small pause to ensure the parent process has exited.
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Copy backup files over the current installation.
  try {
    await fs.promises.cp(src, dest, { recursive: true, force: true });
  } catch (e) {
    logError('Restore copy failed', e);
    // Attempt to restart service even if copy fails.
    try {
      execSync(`"${NssmPath}" start MangoDash`);
    } catch (_) {}
    process.exit(1);
  }

  // Start the MangoDash service again.
  try {
    execSync(`"${NssmPath}" start MangoDash`);
  } catch (e) {
    logError('Failed to start service after restore', e);
    process.exit(1);
  }
})();
