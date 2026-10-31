// CI-only timing controls. No physical host power telemetry is exposed by GitHub.
const os=require('node:os'),fs=require('node:fs'),assert=require('node:assert/strict');
function begin(){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Use the separately controlled Mac protocol outside GitHub Actions');
 assert.equal(process.platform,'linux');
 return {wall:Date.now(),mono:process.hrtime.bigint(),metadata:{platform:os.platform(),release:os.release(),arch:os.arch(),cpus:os.cpus().map(c=>c.model),memoryBytes:os.totalmem(),node:process.version,runner:process.env.RUNNER_ENVIRONMENT,runnerOS:process.env.RUNNER_OS,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,physicalPowerTelemetry:null,physicalSleepTelemetry:null,controls:'One GitHub-hosted VM per profile; no concurrent build, test or comparison process on that VM; wall versus monotonic elapsed checked; never pool with Mac results.',cgroupCpuLimit:fs.existsSync('/sys/fs/cgroup/cpu.max')?fs.readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim():null}};
}
function finish(start){const wallElapsedMs=Date.now()-start.wall,monotonicElapsedMs=Number(process.hrtime.bigint()-start.mono)/1e6,clockDifferenceMs=wallElapsedMs-monotonicElapsedMs;return{...start.metadata,wallElapsedMs,monotonicElapsedMs,clockDifferenceMs,clockConsistent:Math.abs(clockDifferenceMs)<1000,limitations:'Virtual-host pauses, noisy neighbours and physical power state cannot be independently observed. Results describe this runner, not production or the historic Mac.'};}
module.exports={begin,finish};
