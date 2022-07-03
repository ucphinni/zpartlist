#!/usr/bin/env node

const { argv } = require('node:process');
const fs = require('fs');
const path = require('path');
const request = require('request');
const cheerio = require('cheerio');


if (argv.length != 3) {
	console.log("zpartlist (init|<dir>|<config file>)");
	process.exit(1);
}
var arg = argv[2];
if (arg=='init')  {
	const fs = require('fs');
	const content = `{
// This file is in hson format. (json with comments)
	test_names: 
	[
		"James Happy",
		"John Subtle",
		"Always Nice To Everyone",
		"Tom Good Habits", 
		"Susan Pillar", 
		"Sam Upbuilding"
	],
	headless:false,
	test:true,
	skipmedia:false, // turn on to load faster.
	webkit:false, // use chromium if false.
	zoom_scrape: false,
	port: 3000, // port of part list server.
	zoom_wc_link: "", // ENTER INVITE URL HERE!
}`;
	try {
		fs.writeFileSync('config.hson', content);
	} catch (err) {	
		console.error(err);
		process.exit(1);
	}
	process.exit(0);
}	
if (fs.existsSync(arg) && fs.lstatSync(arg).isDirectory()) {
	arg = path.join(arg,"config.hson");
}
else if (fs.existsSync(arg) && fs.lstatSync(arg).isFile()) {}
else  if (!fs.existsSync(arg) ){
	console.error("arg not config file or directory that contains file");
	process.exit(1);
}
function toJSON(input) {
	let UNESCAPE_MAP = { '\\"': '"', "\\`": "`", "\\'": "'" };
	let ML_ESCAPE_MAP = {'\n': '\\n', "\r": '\\r', "\t": '\\t', '"': '\\"'};
	function unescapeQuotes(r) { return UNESCAPE_MAP[r] || r; }

	return input.replace(/`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|\/\*[^]*?\*\/|\/\/.*\n?/g, // pass 1: remove comments
						 function(s) {
		if (s.charAt(0) == '/')
			return '';
		else  
			return s;
	})
	.replace(/(?:true|false|null)(?=[^\w_$]|$)|([a-zA-Z_$][\w_$]*)|`((?:\\.|[^`])*)`|'((?:\\.|[^'])*)'|"(?:\\.|[^"])*"|(,)(?=\s*[}\]])/g, // pass 2: requote
						 function(s, identifier, multilineQuote, singleQuote, lonelyComma) {
		if (lonelyComma)
			return '';
		else if (identifier != null)
				return '"' + identifier + '"';
		else if (multilineQuote != null)
			return '"' + multilineQuote.replace(/\\./g, unescapeQuotes).replace(/[\n\r\t"]/g, function(r) { return ML_ESCAPE_MAP[r]; }) + '"';
		else if (singleQuote != null)
			return '"' + singleQuote.replace(/\\./g, unescapeQuotes).replace(/"/g, '\\"') + '"';
		else
			return s;
	});
}

console.log(arg);
const { webkit ,chromium, firefox, devices  } = require('playwright');
const express = require('express');
const app = express();
let rawdata = fs.readFileSync(arg);
const cfg = JSON.parse(toJSON(rawdata.toString('utf8')));
const emudevice = devices[cfg['emudevice'] || "LG Optimus L70"];
const server = require('http').createServer(app)
const port = process.env.PORT || cfg['port'];
const io = require('socket.io')(server)
app.use(express.static(path.join(__dirname + '/public')));
app.use('/scripts',express.static(__dirname + '/node_modules/fontmetrics/output'));
let names;
const rx = /^(https?\:\/\/.*?\/)j(\/.*?)\?(.*)$/;
let rxa = rx.exec(cfg['zoom_wc_link']);
let res = '';
if (rxa.length) {
	res += rxa[1];
	res += 'wc';
	res += rxa[2];
	res += '/join?';
	res += rxa[3];
	console.warn(res);
	cfg['zoom_wc_link'] = res;
}
const HEADLESS = false || cfg['headless'];
const USEWEBKIT = false || cfg['webkit'];
const USEFIREFOX = false || cfg['firefox'];
const USE = false || cfg['firefox'];
const ZOOMCONNECTURL=cfg['zoom_wc_link'];
const ZOOMSCRAPE = cfg['zoom_scrape'];
const SKIPMEDIA = true || cfg['skipmedia'];
const TEST=cfg['test'];
names = cfg['test_names'];

var Promise = require('promise');

const url = new URL(ZOOMCONNECTURL);
var thispage = {};

class PartList {
	show_name_to_client(name) {

		if (this.working_namelist.find((item) => name === item.name)) {
			return;
		}
		// add it.
		let nmobj = {'name':name,'id':++this.working_id};
		this.working_namelist.push(nmobj);
		io.emit('putName', nmobj);
	}

	remove_name_by_id(id) {
		// Ensure id is there.
		let idx = this.working_namelist.findIndex((item)=>id === item.id);
		if (idx == -1)
			1/0;

		this.working_namelist.splice(idx,1);
		if (!this.working_namelist.length)
			io.emit('clearAll');
		else
			io.emit('removeNameId',id);

	}
	remove_name(name) {
		// Ensure id is there.
		let idx = this.working_namelist.findIndex((item)=>name === item.name);
		if (idx != -1)
			this.remove_name_by_id(this.working_namelist[idx].id);

	}
	test() {
		let curid = 0;
		 {
			setInterval(()=>{
				if (curid % (names.length* 2)  < names.length) {
					this.show_name_to_client(names[curid%names.length]);
				} else {
					this.remove_name(names[curid%names.length]);
				}
				curid++;	
				if (curid % 20)
					return;
			/*	ary = []
				for (let nmobj of working_namelist)
					ary.push(nmobj.id);
				for (let id of ary)
					remove_name_by_id(id); */
			},500);
		}
	}
	create_web_server() {
		io.on('connection', socket => {
			for (let nmobj of this.working_namelist) {
				socket.emit('putName', nmobj);
			}
		})

		server.listen(port, () => {
		  console.log(`Server running on port: ${port}`)
		})
	}
	clear() {
		io.emit('clearAll');
		this.working_namelist=[];
	}
	constructor() {
		this.working_namelist=[];
		this.working_id = 0;
	}

}

class Browser {
	constructor(url) {
		this.browser = null;
		this.url = url;
		this.setup_vars();
	}
	check() {
	
	}
	ensure_leave_url_goes_to_mainurl() {
		let self = this;
		
		this.page.on('domcontentloaded',async page => {
			if (self.leave_url_task_run)
				return; // already running;
			self.leave_url_task_run = true;
			try {
				await page.waitForURL(/.*\/wc\/leave(?:\/|\?)/);
				page.close();
			}
			catch(e) {}
			
			self.leave_url_task_run = false;
		});
	}
	
	ensure_mic_disconnected() {
		let self = this;
		
		this.page.on('domcontentloaded',async page => {
			if (self.disconnect_mic_task_run)
				return; // already running;
			self.disconnect_mic_task_run = true;
			const sel = '[aria-label="More audio controls"]';
			while(this.audioconnected || this.audioconnected === null) {
				try {
					await page.locator('#wc-content').hover();
					await page.waitForSelector(sel);
					await page.locator(sel).first().click();
					await page.locator('text=Leave Computer Audio').first().click();
				}
				catch(e) {
					break;
				}
			}
			self.disconnect_mic_task_run = false;
		});
	}
	ensure_computer_audio_tab_closed() {
		let self = this;
		
		this.page.on('domcontentloaded',async page => {
			if (self.comp_audio_tab_close_task_run)
					return; // already running;
			self.comp_audio_tab_close_task_run = true;
			const sel = 'div[role="tab"] div:has-text("Computer Audio")';
			while(true) {
				try {
					await page.waitForSelector(sel);
					await page.locator('[aria-label="close"]').first().click();
				}
				catch(e) {
					break;
				}
			}
			self.comp_audio_tab_close_task_run = false;
		});
		
	}
	ensure_check_meeting_not_started() {
		let self = this;
		this.page.on('load',async page => {
			if (self.check_meeting_not_started_task_run)
				return;
			self.check_meeting_not_started_task_run = true;
			while (true) {
				try {				
					const xpath ='//title[contains(.,"The meeting has not started")]';
					
					await self.page.waitForSelector(xpath,{state:'attached'});
					await this.meetingNotStartedStatus(true);
					break;
//					await page.waitForSelector(xpath,{state: 'detached'});
//					await page.evaluate(async()=> await meetingNotStartedStatus(false));
				}
				catch(e) {
										
				}
			}
			await page.close();
			self.check_meeting_not_started_task_run = false;

		});
	}
	async meetingNotStartedStatus(begin) {
		if (begin)
			console.log("meeting not started");
		else
			console.log("meeting not started end");

	}
	
	ensure_meeting_entry() {
		let self = this;
		this.page.on('domcontentloaded',async page => {
			if (self.meeting_entry_task_run)
				return;
			self.meeting_entry_task_run = true;
			while (true) {
				try {
					const xpath ='[aria-label="Report Waiting Room"]';
					await page.waitForSelector(xpath);
					await this.waitForMeetingEntryStatus(true);
					await page.waitForSelector(xpath,{state: 'detached'});
					await this.waitForMeetingEntryStatus(false);
					break;
				}
				catch(e) {
					if (page.isClosed())
						break;
				}
			}
		});
	}
	async waitForMeetingEntryStatus(begin) {
		if (begin)
			console.log("waitForHost begin");
		else
			console.log("waitForHost end");

	}
	async ensure_host_there_and_enter_name() {
		let self = this;
		if (self.login_page_task_run)
				return; // already running;
		const page = this.page;
		self.login_page_task_run = true;
		const sel = '//title[contains(.,"Zoom meeting on web")]';
		while(true) {
			try {
				await page.waitForSelector(sel,{state:'attached'});
				await this.enteringNameStatus(true);

				let x = self.page.locator('#inputname');
				await x.click();
				await x.fill('Part4ListBot');
				await page.locator('#joinBtn').click();
				await page.waitForSelector(sel,{state:'hidden'});
				await this.enteringNameStatus(false);
				break;
			}
			catch(e) {
				continue;
			}
		}
		self.login_page_task_run = false;
		this.ensure_meeting_entry();
	}
	async enteringNameStatus(begin) {
		if (begin)
			console.log("enter name start");
		else
			console.log("enter name end");

	}
	async ensure_main_window_setup() {
		const page = this.page;

		while (true) {
			try {
				if (!page)
					break;
				await page.waitForSelector('.meeting-app',{state:'visible'});
				await page.locator('.meeting-app').first().hover();
				await page.waitForSelector('#participants-ul',{state: 'detached'});
				const sel = '[aria-label="More meeting control"]';
				if (this.videoon || this.videoon === null) {
					await page.waitForSelector(sel,{timeout:5000});
					await page.locator(sel,{timeout:5000}).click();
					console.log("Looking for"); 
					if (await page.$('text=Stop Incoming Video'),{timeout:5000}) {
						await page.locator('text=Stop Incoming Video').click({timeout:10000});
					}
					else
						await page.keyboard.press('Escape');
				}
				console.log("sel");

				await page.waitForSelector(sel,{timeout:5000});
				await page.locator(sel,{timeout:5000}).click();
				console.log("Part?");
				if (page.$('text=Participants',{timeout:2000}))
					await page.locator('text=Participants').click();
				else
					await page.locator('//button[contains(., "Participants")]',{timeout:2000}).first().click();

				await page.waitForSelector('#participants-ul',{state: 'attached',timeout:2000});
			}

			catch (e) {
				if (e.name == 'TimeoutError')
					continue;

				console.log(e);
				if (page.isClosed())
					break;
			}
		}
	}

	ensure_part_list_up() {
		let self = this;
		this.page.on('load',async () => {
			if (self.part_win_task_run)
					return; // already running;
			self.part_win_task_run = true;
			let page = self.page;
			while (true) {
				try {
					if (!page)
						break;
					await page.waitForSelector('.meeting-app',{state:'visible'});
					await page.locator('.meeting-app').first().hover();
					await page.waitForSelector('#participants-ul',{state: 'detached'});
					await page.locator('//button[contains(., "Participants")]').first().click();
					await page.waitForSelector('#participants-ul',{state: 'attached',timeout:2000});
				}
				catch (e) {
					console.log(e);
					if (page.isClosed())
						break;
				}
			}	
			self.part_win_task_run = false;
		});

	}
	async partListStatus(begin) {
		if (begin)
			console.log("partListStatus start");
		else
			console.log("partListStatus end");
	}
	ensure_dialogs_dismissed() {
		let self = this;
		this.page.on('domcontentloaded',async page => {
			if (self.dialogs_dismissed_task_run)
					return; // already running;
			const sel = '//div[@class="ReactModalPortal"]//button[contains(concat(" ", @class," "), "-primary")]';
			self.dialogs_dismissed_task_run = true;
			while (true) {
				try {
					await page.waitForSelector(sel,{state:'visible'});
					await page.locator(sel).first().click();
				}
				catch (e) {
					if(page.isClosed())
						break;
				}
			}	
			self.dialogs_dismissed_task_run = false;
		});
	}
	partClear() {
		this.part_list.clear();
	}
	partBegin() {
		console.log("partBegin")
	}
	partEnd() {
		console.log("partEnd")

	}
	partAdd(d) {
		console.log("participant added " + d.name);
		let del = d.dup || !d.handup;
			
		if (del)
			this.part_list.remove_name(d.name);
		else
			this.part_list.show_name_to_client(d.name);
	}
	partDel(d) {
		console.log("participant del " + d.name);
		this.part_list.remove_name(d.name);
	}
	partMe(pa) {
		console.log("participant me");
		this.videoon = !pa["videooff"];
		this.audioconnected = !!pa["audioconnected"];
		if (this.videoon !== null && !this.videoon && 
		this.audioconnected !== null && !this.audioconnected && this.hovertimer) {
			clearInterval(this.hovertimer);
		}
		else if (!this.hovertimer) {
			const self = this;
			this.hovertimer = setInterval(async ()=>{
				await self.page.locator('.meeting-app').first().hover();
				console.log(self.audioconnected);
				if (self.audioconnected || self.audioconnected === null) {
					const page = self.page;
					await page.locator('#wc-content').hover();
					const sel = '[aria-label="More audio controls"]';
					await page.waitForSelector(sel);
					await page.locator(sel).first().click();
					await page.locator('text=Leave Computer Audio').first().click();
				}
			},10000);
		}
	}
	 waitForSelectorDetach(selector) {
		if (this.page && !this.page.isClosed()) {
			console.log("waiting for selector "+selector);
			let self = this;
			( async ()=>{
				try {
		
					await self.page.waitForSelector(selector,{state: 'attached',timeout:0});
								console.log("waitingw for selector "+selector);

					await self.page.waitForSelector(selector,{state: 'detached',timeout:0});				
					
				}
				catch(e) {
					
				}
			})();
			console.log("done waiting for selector "+selector);
		}
	}
	async setup_browser() {
		// Chromium is more easily debugable but webkit is more performant.
		if (USEWEBKIT) {
			this.browser = await webkit.launch({
				headless: HEADLESS,
			});
		}
		if (USEFIREFOX) {
			this.browser = await firefox.launch({
				headless: HEADLESS,
			});
		}
		if (!USEFIREFOX && !USEWEBKIT) {
			this.browser = await chromium.launch({
				headless: HEADLESS,
			});
		}
	}
	async setup_page() {
		let context = await this.browser.newContext({
			permissions: [],
			viewport: emudevice.viewport,
			userAgent: emudevice.userAgent,
		});
		context.setDefaultTimeout(3*3600*1000);
		this.page = await context.newPage();
		this.page.setDefaultTimeout(3*3600 *1000);
		
		await this.page.addInitScript(() => {
			delete window.navigator.serviceWorker;
			window.asleep = async function(ms) {
				return new Promise(resolve => setTimeout(resolve, ms));
			}
			window.addEventListener('unload', function () {
				document.documentElement.innerHTML = '';
			});
			let curracts = {};
			function chgchk(chg,ret,key,x) {
				if (key in ret && !ret[key] && x  ||
				   !(key in ret) && x ||
				   key in ret && ret[key] && !x){
					ret[key] = !!x;
					chg =  true;
				}
				return chg;
			}
			let seqno = 0;
			function getPartAction(node) {
				let str;
				let nameNode=node.querySelector(".participants-item__display-name");
				let name = nameNode.textContent;
				let dup = false;
				let add = false;
				let labelNode = node.querySelector(".participants-item__name-label");
				let label = labelNode.textContent;

				str = node.getAttribute('aria-label');
				if (str.includes(name))
					str = str.replace(name,"");
				
				if (str.includes(label))
					str = str.replace(label,"");

				let chg,ret,delvals;
				if (name in curracts) {
					ret = curracts[name];
					add = ret.seqno + 1 < seqno;
					delvals = add;
				}
				else {
					add = true;
					curracts[name] = ret = {};
				}
				dup = ret.seqno >= seqno;
				if (!delvals)
					delvals = dup;
					
				if (delvals) {
					if (!dup)
						delete ret['dup'];
					delete ret['handup'];
					delete ret['unmuted'];
					delete ret['audioconnected'];
					delete ret['videooff'];
				}
				if (add) {
					ret.name = name;
					chg = chgchk(true,ret,'me',         label.includes("me") || label.includes("Me"));
				}
				ret.seqno = seqno;
				chg = chgchk(chg,ret,'dup',            dup);
				chg = chgchk(chg,ret,'handup',         str.includes(' hand raised'));
				chg = chgchk(chg,ret,'unmuted',        str.includes(' audio unmuted'));
				chg = chgchk(chg,ret,'audioconnected',!str.includes('no audio connected'));
				chg = chgchk(chg,ret,'videooff',       str.includes("video off"));

				ret.action =  dup ? "dup" : add? "add" : chg ?  "upd" : "unchg";
			}
			let partListUlNode;
			let partListObserver = new MutationObserver(() => {
				let beginSent = false;
				console.log("mutation")
				++seqno;				
				for (let node of partListUlNode.querySelectorAll(".participants-li")) {
					getPartAction(node);					
				}
				for (let name in curracts) {
					let d = curracts[name];
					let partme = d.me;
					let del = d.seqno +1 == seqno && d.seqno != 1;
					let add = d.seqno == seqno;
					let skip = !(add || del || partme ) ||  d.action == "unchg";
					if (skip)
						continue;

					if (!beginSent && (add || del || partme )) {
						beginSent = true;
						partBegin();
					}
					if (partme)
						partMe(d);
					else if (del)
						partDel(d);
					else if (add)
						partAdd(d);
				}
				if (beginSent)
					partEnd();
					
			});
			partListUlNode = window.document.getElementById('participants-ul');
			console.log("here");
			let initpartnode = false;
			new MutationObserver((mutationRecord)=> {
				for (let mutation of mutationRecord){
					for (let node of mutation.removedNodes)
						if (partListUlNode && node.id === 'participants-ul') {
							partListObserver.disconnect();
							partListUlNode = document.getElementById('participants-ul');
						}
	
					if (!mutation.addedNodes.length && initpartnode)
						continue;
					var node = document.getElementById('participants-ul');
					if (!initpartnode) {
						partListUlNode = null;
					}
					if (!partListUlNode && node || !initpartnode) {
						initpartnode = true;
						partClear();
						partListUlNode = node;
						partListObserver.disconnect();
						partListObserver.observe(node,{
							attributeFilter:['aria-label'],
							attributes:true,childList:true, subtree:true
						});
					}
				}
			}).observe(document.getRootNode(),{childList:true, subtree:true});

		});
		if (SKIPMEDIA)
			await this.page.route('**/*',(req)=> {
				if (["media","image","font","texttrack","manifest","other"].includes(req.request().resourceType())) {
				  return req.abort();
				}
				req.continue();
			});
		

		thispage[this.page] = this

		// this.page.on('domcontentload',function() {self.load_std_functs(self)} );
		await this.page.exposeBinding('partClear', async ({ page } ) => {
			await thispage[page].partClear();
		});
		await this.page.exposeBinding('partBegin', async ({ page } ) => {
			await thispage[page].partBegin();
		});
		await this.page.exposeBinding('partEnd', async ({ page } ) => {
			await thispage[page].partEnd();
		});
		await this.page.exposeBinding('partAdd', async ({ page } , a) => {
			await thispage[page].partAdd(a);
		});
		await this.page.exposeBinding('partMe', async ({ page } , a) => {
			await thispage[page].partMe(a);
		});
		await this.page.exposeBinding('partDel', async ({ page } , a) => {
			await thispage[page].partDel(a);
		});
		await this.page.exposeBinding('partListStatus', async ({ page } , begin) => {
			await thispage[page].partListStatus(begin)
		});
		await this.page.exposeBinding('waitForSelectorDetach', async ({ page } ,selector) => {
			await thispage[page].waitForSelectorDetach(selector)
		});
//		this.ensure_check_meeting_not_started();
		this.ensure_dialogs_dismissed();
		this.ensure_leave_url_goes_to_mainurl();
		await this.page.goto(this.url.href);
		this.page.on('close',async (page)=>{
			delete thispage[page];
			this.install_wc_browser();			
		});

	}
	setup_vars() {
		this.page = null;
		this.login_page_task_run = false;
		this.stop_video_task_run = false;
		this.part_win_task_run = false;
		this.comp_audio_tab_close_task_run = false;
		this.disconnect_mic_task_run = false;
		this.meeting_entry_task_run = false;
		this.dialogs_dismissed_task_run = false;
		this.leave_url_task_run = false;
		this.videoon = null;
		this.audioconnected = null;
		this.hovertimer = null;
		this.part_list = new PartList();
		
	}
	install_wc_browser() {
		let self = this;
		async function wait_for_meeting_start() {
			console.log("attempting to connect to zoom");
			attempt_to_connect();
		}
		async function attempt_to_connect() {
			request(url.href,async (error,response,body)=>{
				if (!error && response.statusCode == 200) {}
				else {
					console.log(error);
					setTimeout(wait_for_meeting_start,10000);
					return;
				}
				const $ = cheerio.load(body);
				if ($("title").text().includes("meeting has not started")) {
					console.log($("title").text());
					setTimeout(wait_for_meeting_start,10000);
					return;
				}
				await self.setup_browser();
				await self.setup_page();
				await self.ensure_host_there_and_enter_name();
				if (!USEWEBKIT) {
					self.ensure_mic_disconnected();
					self.ensure_computer_audio_tab_closed();
					await self.ensure_main_window_setup();
				}
				else
					self.ensure_part_list_up();

			});
			
		}
		(async()=> {
			await attempt_to_connect();
		})();
		
	}
	
	async run() {
		if (ZOOMSCRAPE) {
			this.install_wc_browser();
		}
		this.part_list.create_web_server();
		if (TEST)
			this.part_list.test();
	}
};
var browser = new Browser(url);
browser.run();
process.on('SIGINT', function() {
    console.log("Caught interrupt signal");

        process.exit();
});
