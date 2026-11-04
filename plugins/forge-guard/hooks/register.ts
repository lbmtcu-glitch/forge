import type { Register } from 'claude-code'

const RULES = `FORGE GUARD — the 10 rules, enforced by code this session:
1 READ FIRST: read every record, mail, attachment and file the answer needs before replying.
2 DO, DON'T OFFER: never "want me to", "if you want", "I can also", "let me know", "I'll do that next". Tool-doable = done now.
3 ASK ONLY CRITICAL: one YOUR DECISIONS list; act on the default for the rest the same turn.
4 CLICKABLE ONLY: exact https links, file cards, Gmail draft links. Never file:/// or computer://.
5 NOTHING GOES OUT WITHOUT HIS ORDER; with it, send the same turn and read Sent back.
6 TRUTH: claim only what a tool returned this turn; never invent a fact, name or link.
7 SAVE IT WHERE IT LIVES: every built file goes to the forge's file store the turn it is built, named CODE_TYPE_SUBJECT_YYYYMMDD.
8 CALENDARS: only the forge's named calendars; must-attend events stand alone; tasks go in one daily DUE digest.
9 ONE LEDGER: every open item is a row in the forge's ledger; no CLOSE while tool-doable work is open.
10 FIX BY REPLACING: a miss rewrites the failed rule or adds a check; never a new rule beside it.
Replies that break 2 or 4 are sent back automatically.`

// 1.1.0: only a real link (scheme followed by a path), not a prose mention of the scheme name
const DEAD_LINK = /(file:\/\/\/[A-Za-z0-9~%._\-\/]|computer:\/\/[A-Za-z0-9~%._\-\/])/i
// 1.1.0: his own word "send" is the order; no draft step
const SEND_ORDER = /\bsend\b/i
const OFFERS = /\b(want me to|if you want|i can also|let me know|i haven'?t read|i'll do that next|shall i|would you like me to)\b/i

let draftedThisSession = false
let sendOrdered = false
let redoneTurn: string | undefined

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return { sections: [...r.sections, { id: 'forge-guard:rules', text: RULES, scope: 'session' as const }] }
  })

  on('prompt.submit', async ($, e, next) => {
    sendOrdered = SEND_ORDER.test(String((e as { text?: string }).text ?? ''))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const tool = String((e as { tool?: string }).tool ?? '')
    const body = JSON.stringify(e)
    if (/Gmail__create_draft|Gmail__update_draft/.test(tool)) draftedThisSession = true
    if (/Gmail__send_message|Gmail__reply|Gmail__forward/.test(tool) && !draftedThisSession && !sendOrdered)
      return { deny: 'forge-guard rule 5: make the Gmail draft and show it first; send only on his order.' }
    if (!/^(Read|Grep|Glob|Bash)$/.test(tool) && DEAD_LINK.test(body))
      return { deny: 'forge-guard rule 4: file:/// and computer:// do not click. Use an https link or a file card.' }
    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : next(e)))

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const text = r.text ?? ''
    const id = (e as { turnId?: string }).turnId
    const hit = text.match(OFFERS)?.[0] ?? text.match(DEAD_LINK)?.[0]
    if (hit && redoneTurn !== id && !(e as { agentId?: string }).agentId) {
      redoneTurn = id
      $.ui.toast(`forge-guard: reply broke a rule ("${hit}") — redoing`)
      await $.prompt.submit({ text: `forge-guard: your last reply contained "${hit}", which breaks rule ${DEAD_LINK.test(hit) ? 4 : 2}. Do that work now with the tools, then give the reply again without it.` })
    }
    return r
  })
}
