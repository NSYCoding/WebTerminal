# WebTerminal
This is a web terminal using WebSockets and Express.js.

User Stories:
- I made this because I wanted to have terminal access from more than just my laptop's ssh access.
- Due to phones and tablets not being able to always have SSH besides that I also wanted to access the device without needing my own device.
- Outside home network access (still in development)

Features:
- Home network access
- Web UI
- Responsive

Todo:
- Secure with cloud tunnel server from VPS as relay.
- Add UI Commands.
- Add debugging.

How to use:
- `git clone <this-repo>`
- `cd <project-folder>`
- Create `.env` to have the right environment variables:
    VALID_USERNAME=YOUR_USERNAME
    VALID_PASSWORD=YOUR_PASSWORD
    PORT=5643 (optional)
- Save the `.env`
- Run `npm install`
- Run `npm run start`

Tada! Now you have Terminal in the web.