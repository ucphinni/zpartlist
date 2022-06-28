## ZPartList

## Display Hands up from Zoom™

ZPartlist is a self-contained mobile-ready NodeJs webapp which displays to  
connecting clients with the raised hand in a screen size and distance compensation manner.

## Features

*   Animated display of names of clients.
*   Given the diagonal size of the screen and the distance, calculate the appropriate font size with comfortable Vendera font assuming 20/20 vision. Works even if viewport only takes up a portion of the screen.
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

And, of course, ZPartList itself is open source with a [public repository](https://github.com/ucphinni/zpartlist)  on GitHub.

## Installation

ZPartList requires [Node.js](https://nodejs.org/) v10+ to run. Download and install for your OS. Windows and Linux has been tested. Mac prob works as well.

Run the script using the following commands.

```plaintext
cd <your directory of choice>
npx zpartlist@latest init
<modify the config.hson file>
npx zpartlist@latest ./config.hson
```

## Configuration (config.hson)

```plaintext
{
	test_names: <list of strings>
,
	test:<true to turn on the tester which will add and delete the test_names in a loop>,
	webkit: <true to turn on instead of chromium... BROKEN>,
	headless: <true to hide the browser from view>
	zoom_scrape: <true to turn on the web client functionality>,
	port: 3000,
	zoom_wc_link: "https://us02web.zoom.us/j/..." <<< You can get this from the invitation link.
}
```

## Usage

Use any browser or (browser source in obs) and point to your server.
http://<your server ip or 127.0.0.1> : <port>?dia=<diameter of scren>&dist=<viewing distance>&nb

NOTE: dia and dist must be the same units. Remove the nb to get a colorful background (Good viewing in a browser instead of OBS)

## License

MIT

**Free Software**