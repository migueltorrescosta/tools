# Agent Instructions

Work is tracked as GitHub issues on the Epics project (https://github.com/users/migueltorrescosta/projects/3). An issue never results in more than one PR, and each PR closes its issue with a closing keyword (`Closes migueltorrescosta/tools#N`).

## Package Manager

**pnpm** is the canonical package manager for this repo. Use `pnpm` for installs and scripts (`pnpm install`, `pnpm run dev`, `pnpm test`). Do not use npm. The repo tracks `pnpm-lock.yaml` and not `package-lock.json`; node version is pinned in `.nvmrc`.
