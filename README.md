# The Swan — Station 3

A browser simulator of the Swan station countdown from *Lost*.

- The flip clock counts down from **108:00**. The black cards show minutes and the white cards show seconds.
- At **4:00** the execution window opens and the alarm starts beeping.
- At **1:00** the alarm becomes continuous.
- At **0:00** the cards flip to hieroglyphs (system failure).
- To reset to 108:00, type `4 8 15 16 23 42` at the `>:` prompt and press **Enter**.

## Run

```bash
python3 -m http.server 8108
```

Then open http://localhost:8108. You can also open `index.html` directly.

Click or press a key once so the browser allows sound.

## Home Assistant (Hue light alarm)

When the 4:00 window opens, the page calls a Home Assistant webhook. An automation then blinks a light red until the code is entered, and puts the light back the way it was.

1. In Home Assistant, create a new automation, switch to YAML, and paste [`home-assistant/swan_alarm_automation.yaml`](home-assistant/swan_alarm_automation.yaml).
2. Replace `light.living_room` with your Hue light's entity id (in two places), then save.
3. In [`config.js`](config.js), set `homeAssistantUrl` (e.g. `http://192.168.10.68`, include the port if it isn't 80). The webhook ids must match the ones in the automation.

The webhooks are `local_only`, so the browser must be on the same network as Home Assistant. To turn the integration off, set `homeAssistantUrl: ''`.

## Testing options

| Query param | Effect |
|---|---|
| `?start=250` | Start the countdown at 250 seconds |
| `?speed=10` | Run time 10× faster |

Without these params, the deadline is saved in `localStorage`, so reloading the page doesn't reset the timer.
