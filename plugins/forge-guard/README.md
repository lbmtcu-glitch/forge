# forge-guard
Enforces Dr. McKenzie's ten forge-core rules in code instead of prose. It appends the ten rules to the system prompt on every turn, blocks any tool call that writes a file:/// or computer:// link, blocks a Gmail send, reply or forward when no draft was made first, and sends back once any reply that offers work ("want me to", "if you want", "let me know") instead of doing it.
