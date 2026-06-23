# GitLab Project Setup & Runner Notes

This document summarizes the work completed to get the GitLab project and CI runner working.

## Repository
- Project: `c2510537002/automated-app`
- Remote configured to:
  - `https://git.hcw.ac.at/c2510537002/automated-app.git`

## What was done

### 1) GitLab Runner registration
- A GitLab Runner was registered successfully using the new authentication token workflow.
- The runner was registered against the GitLab instance:
  - `https://git.hcw.ac.at`
- The runner is configured as a **Project Runner**.

### 2) Runner configuration
- The runner configuration was persisted in:
  - `/etc/gitlab-runner/config.toml`
- The runner uses the **Docker executor**.
- The runner is configured with **least privilege** in mind:
  - `privileged = false`
  - no unnecessary mounts beyond the Docker socket and runner config volume
  - project-scoped runner instead of an instance-wide runner

### 3) Docker container setup for the runner
- The GitLab Runner container was started with:
  - `/var/run/docker.sock` mounted
  - a persistent volume mounted at `/etc/gitlab-runner`
- The persistent volume used is:
  - `gitlab-runner-config`
- This ensured the runner configuration remains available after container restarts.

### 4) CI pipeline update
- The `.gitlab-ci.yml` file was created/updated to define three stages:
  - `test`
  - `security`
  - `deploy`
- The pipeline includes:
  - a Python test job
  - a Trivy security scan job
  - a Docker-based deploy job

### 5) Runner tag matching
- The GitLab jobs were updated to match the runner tags.
- The runner/job tags used are:
  - `home`
  - `automatic`
  - `security checks`
- This resolved the “job is stuck because the project doesn't have any runners online assigned to it” issue.

### 6) Commit and push flow
- The CI changes were committed locally on `main`.
- The changes were pushed to GitLab successfully.

## Current state
- Runner is registered and working.
- The project CI pipeline is now functional.
- The setup follows a least-privilege approach as much as possible.

## Notes
- The runner token should be treated as sensitive and rotated if needed.
- If the runner ever goes offline, verify the container and the mounted config volume first.
- If jobs become stuck again, check that the job tags still exactly match the runner tags.

## Useful commands

### Check runner config
```bash
docker exec -it gitlab-runner sh -lc 'ls -la /etc/gitlab-runner && cat /etc/gitlab-runner/config.toml'
```

### Check runner logs
```bash
docker logs --tail 50 gitlab-runner
```

### Check Git remote
```bash
git remote -v
```

### View current branch
```bash
git branch --show-current
```

## Result
Everything is now configured and working for the GitLab project.
