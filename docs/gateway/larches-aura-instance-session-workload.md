---
summary: "Larches Aura host session/compaction overrides. Instance-specific, not OpenClaw defaults."
read_when:
  - Documenting the Aura OpenClaw host session workload policy
  - Tuning Discord parent/thread context growth on this instance
  - Explaining why LLM compact is not enough for tool-heavy Discord parents
title: "Larches Aura instance session workload"
---

# Larches Aura instance session workload

<Warning>
This page records **runtime policy for the Larches Aura OpenClaw host**, not
upstream OpenClaw product defaults. Do not copy these values into generic docs,
installer defaults, or other deployments unless the same Discord/tool-heavy
workload applies.
</Warning>

Host: Aura gateway on Charles's OpenClaw instance.
Recorded: 2026-08-13 after live inspection and an explicit config change.
OpenClaw version at change time: `2026.7.1-2 (0790d9f)`.

## Why this instance needed overrides

This host is not a casual single-chat assistant. The Discord workspace is a
set of long-lived project parents that accumulate:

- tool-call / `toolResult` dumps
- subagent completion events injected as user-looking messages
- channel heartbeats
- ACP / thread-bound implementation work

Official LLM compact (`/compact` or `openclaw sessions compact <sessionKey>`)
is still the first path. On this host it is **not sufficient** for the worst
parents:

- `contextTokens` is the model window (commonly 380k / 450k here), not usage.
- Real size is `totalTokens` / active transcript bytes.
- `#情緒價值及支援` had ~1.35M recorded tokens / ~1.4MB transcript, 4 user turns,
  151 assistant turns, 145 tool results, and 5 prior compaction entries.
  Official compact returned `ok` with `compacted: false` and
  `reason: "no real conversation messages"`.
- `#pybc-tf-foundation` was ~1.49M tokens / ~0.9MB.
- `#goxip` was ~105k tokens / ~0.6MB.
- Live channels (`#general`, `#pybc-website`) were left alone during that
  inspection.

The failure mode is structural: a Discord **parent** becomes an implementation
dump. Gateway then refuses to summarize because it does not see a normal chat
turn stream. Byte-guard compaction cannot help if LLM compact never succeeds.

## Policy chosen for this workload

Keep ordinary chat channels long-lived. Recreate **group/channel parents** on
idle, and stop thread/ACP children from forking the parent transcript.

Do **not** periodically `/new` every Discord session. Only tool-heavy parents
and completed work slices need a hard reset, after writing durable notes.

### Applied 2026-08-13 (explicit approval)

These two writes were approved in `#general` and verified after gateway restart:

```json5
{
  session: {
    resetByType: {
      group: {
        mode: "idle",
        idleMinutes: 1440, // 24h of real user/channel idle
      },
    },
  },
  channels: {
    discord: {
      threadBindings: {
        enabled: true,
        idleHours: 24,
        maxAgeHours: 0,
        spawnSessions: true,
        defaultSpawnContext: "isolated", // was "fork"
      },
    },
  },
}
```

Effects:

- Discord group/channel parents open a new `sessionId` after 24 hours with no
  real user/channel activity. Heartbeat, cron, and exec traffic must not extend
  that idle window.
- New thread-bound native subagent sessions start clean. They no longer inherit
  the parent transcript.
- Existing sessions and already-forked threads are **not** rewritten. Idle
  reset applies on the next qualifying inbound after expiry.
- DMs and non-Discord channels were not changed.

`session.resetByType.group` applied without restart.
`channels.discord.threadBindings.defaultSpawnContext` required a gateway
restart. Post-restart health: Discord connected, config valid.

### Already live on this host (supporting knobs)

These were already set before the 2026-08-13 approval. They stay part of the
instance profile because they match the same workload:

```json5
{
  session: {
    dmScope: "per-channel-peer",
    threadBindings: {
      enabled: true,
      idleHours: 24,
      maxAgeHours: 0,
    },
    maintenance: {
      mode: "enforce",
      pruneAfter: "7d",
      maxEntries: 500,
      resetArchiveRetention: "14d",
      maxDiskBytes: "2gb",
      highWaterBytes: "1500mb",
    },
  },
  agents: {
    defaults: {
      compaction: {
        mode: "safeguard",
        keepRecentTokens: 40000,
        reserveTokensFloor: 80000,
        midTurnPrecheck: { enabled: true },
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 40000,
          forceFlushTranscriptBytes: "1mb",
        },
        truncateAfterCompaction: true,
        maxActiveTranscriptBytes: "400kb",
        notifyUser: true,
      },
    },
  },
  channels: {
    discord: {
      historyLimit: 0,
    },
  },
}
```

`historyLimit: 0` means Discord does not inject recent channel history into
every turn. Context growth on this host comes from the session transcript and
tool output, not Discord backfill.

## Operator practice on this host

1. Prefer official compact first:
   - `/compact` in the channel, or
   - `openclaw sessions compact "<sessionKey>" --json`
2. If compact returns `no real conversation messages`, do **not** hand-edit
   `.jsonl`. Write durable notes, then either:
   - `/new` after a checkpoint (clean successor), or
   - `openclaw sessions compact "<sessionKey>" --max-lines 150` as a hard tail
     keep when the channel must continue immediately.
3. Project parents stay orchestrators. Implementation, scans, and evidence
   gathering go to isolated children.
4. After ~100k tokens, checkpoint and `/new` at the next safe step. Do not wait
   for overflow.
5. Ignore `*.trajectory.jsonl` size. Those files are debug sidecars, not the
   model context.

## What this is not

- Not an upstream default proposal.
- Not a reason to idle-reset DMs or all chat types.
- Not authorization to auto-merge, rewrite live transcripts, or compact a
  currently running turn just because the file is large.
- Not a substitute for memory/KB writes before `/new`.

## Related official docs

- [Session management](/concepts/session)
- [Compaction](/concepts/compaction)
- [Session pruning](/concepts/session-pruning)
- [Gateway configuration](/gateway/configuration)
- [Config agents](/gateway/config-agents)
