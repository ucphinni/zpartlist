## ZPartList

## Display Hands up from Zoom™

ZPartlist is a self-contained mobile-ready NodeJs webapp which displays to  
connecting clients with the raised hand in a screen size and distance compensation manner.

## Features

*   Animated display of names of clients.
*   Given the diagonal size of the screen and the distance, calculate the appropriate font size 
*   Ability to turn off background – OBS friendly.
*   Given the web client link, it automatically logs in (Host must accept the bot)
*   The bot automatically disconnects audio and video and microphone to limit bandwidth usage. 
*   No co-host privilege required.

## Tech

ZPartList uses a number of open source projects to work properly:

*   [node.js](http://nodejs.org) - evented I/O for the backend
*   [Express](http://expressjs.com) - Web Server framework.
*   [Socket.io](http://socket.io) - Socket Streaming library
*   [Playwright](https://playwright.dev) - Microsoft's Headless web browser software.

And, of course, ZPartList itself is open source with a [public repository](https://github.com/ucphinni/zpartlist)  
on GitHub.

## Installation

ZPartList requires [Node.js](https://nodejs.org/) v10+ to run.

Install the dependencies and start the server.

```plaintext
cd zpartl
npm i
node zpart.js
```

## Configuration (config.json)

```plaintext
{
	"test_names": <list of strings>
,
	"test":<true to turn on the tester which will add and delete the test_names in a loop>,
	"zoom_scrape": <true to turn on the web client functionality>,
	"port": 3000,
	"zoom_wc_link": "https://us02web.zoom.us/wc/<meetingid>/join?pwd=<password code>" <<< You can get this from the invitation link.
}
```

## License

MIT

**Free Software**