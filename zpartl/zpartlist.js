#!/usr/bin/env node

const { argv } = require('node:process');
const fs = require('fs');
const path = require('path');
if (argv.length != 3) {
	console.log("zpartlist (init|<dir>|<config file>)");
	process.exit(1);
}
var arg = argv[2];
if (arg=='init')  {
	const fs = require('fs');
	const content = `{
	"test_names": 
	[
		"James Happy",
		"John Subtle",
		"Always Loves Everyone",
		"Tom Good Habits", 
		"Susan Pillar", 
		"Sam Upbduilding"
	],
	"test":true,
	"zoom_scrape": false,
	"port": 3000,
	"zoom_wc_link": "https://us02web.zoom.us/wc/<meetingid>/join?pwd=<pwd>"
}`;
	try {
		fs.writeFileSync('config.json', content);
	} catch (err) {	
		console.error(err);
		process.exit(1);
	}
	process.exit(0);
}	
if (fs.existsSync(arg) && fs.lstatSync(arg).isDirectory()) {
	arg = path.join(arg,"config.json");
}
else if (fs.existsSync(arg) && fs.lstatSync(arg).isFile()) {}
else  if (!fs.existsSync(arg) ){
	console.error("arg not config file or directory that contains file");
	process.exit(1);
}
console.log(arg);
const { chromium } = require('playwright');
const express = require('express');
const app = express();
const rawdata = fs.readFileSync(arg);
const cfg = JSON.parse(rawdata);

const server = require('http').createServer(app)
const port = process.env.PORT || cfg['port'];
const io = require('socket.io')(server)
app.use(express.static(path.join(__dirname + '/public')));
app.use('/scripts',express.static(__dirname + '/node_modules/fontmetrics/output'));
let names;
const ZOOMCONNECTURL=cfg['zoom_wc_link'];
const ZOOMSCRAPE = cfg['zoom_scrape'];
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
			for (var nmobj of this.working_namelist) {
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
			while(this.audioconnected) {
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
				}
				catch(e) {
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
	ensure_host_there_and_enter_name() {
//		await this.page.waitForFunction(() => ! document.title.includes('The meeting has not started'))
		let self = this;
		this.page.on('domcontentloaded',async page => {
			if (self.login_page_task_run)
					return; // already running;
			self.login_page_task_run = true;
			const sel = '//title[contains(.,"Zoom meeting on web")]';

			while(true) {
				try {
					await page.waitForSelector(sel,{state:'attached'});
					await this.enteringNameStatus(true);

					let x = self.page.locator('[placeholder="Your Name"]');
					await x.click();
					await x.fill('PartListBot');
					await page.locator('#joinBtn').click();
					await this.enteringNameStatus(false);

				}
				catch(e) {
					break;
				}
			}
			self.login_page_task_run = false;
		});
	}
	async enteringNameStatus(begin) {
		if (begin)
			console.log("enter name start");
		else
			console.log("enter name end");

	}

	ensure_stop_incomming_video() {
//		await this.page.waitForFunction(() => ! document.title.includes('The meeting has not started'))
		let self = this;
		this.page.on('domcontentloaded',async page => {
			if (self.stop_video_task_run)
					return; // already running;
			self.stop_video_task_run = true;
			const sel = '[aria-label="More meeting control"]';
			while(this.videoon) {
				try {
					await page.locator('#wc-content').hover();
					await page.waitForSelector(sel);
					await page.locator(sel).click();
					if (await page.$('text=Stop Incoming Video')) {
						await page.locator('text=Stop Incoming Video').click();
					}
					else
						await page.keyboard.press('Escape');
					break;
				}
				catch(e) {
				}
			}
			self.stop_video_task_run = false;
		});
	}	// as a side effect, this function registers the mutation observer function.
	ensure_part_list_up() {
		let self = this;
		this.page.on('domcontentloaded',async page => {
			if (self.part_win_task_run)
					return; // already running;
			self.part_win_task_run = true;
			while (true) {
				try {
					await page.waitForSelector('.meeting-app',{state:'visible'});
					await page.locator('.meeting-app').first().hover();

					if (await self.page.$('#participants-ul')) {
						console.log("startPartListObserving");
						await page.evaluate(()=> startPartListObserving() );
						await page.waitForSelector('#participants-ul',{state: 'detached'});
						console.log("stopPartListObserving");
						await page.evaluate(()=> stopPartListObserving() );
						continue;
					}
					await page.locator('//button[contains(., "Participants")]').first().click();
					await page.waitForSelector('#participants-ul',{state: 'attached',timeout:2000});
				}
				catch (e) {}
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
				catch (e) {}
			}	
			self.dialogs_dismissed_task_run = false;
		});
	}
	partClear() {
		console.log("participant clear");
		this.part_list.clear();
	}
	partBegin() {
	}
	partEnd() {
	}
	partAdd(name) {
		console.log("participant added");
		this.part_list.show_name_to_client(name);
		
	}
	partDel(name) {
		this.part_list.remove_name(name);

	}
	partMe(pa) {
		this.videoon = !pa["videooff"];
		this.audioconnected = pa["audioconnected"];
		if (!this.videoon && !this.audioconnected && this.hovertimer) {
			clearInterval(this.hovertimer);
		}
		else if (!this.hovertimer) {
			const self = this;
			this.hovertimer = setInterval(async ()=>{
				await self.page.locator('.meeting-app').first().hover();
			},10000);
		}
	}
	partUpd(dict,oldDict) {
		this.part_list.show_name_to_client(dict['name']);
	}
	async setup_browser() {
		this.browser = await chromium.launch({
			channel: 'msedge', // or 'chrome', 'chrome-beta', 'msedge-beta', 'msedge-dev', etc.
			headless: true,
		});
	}
	async setup_page() {
		let context = await this.browser.newContext({
			permissions: [],
		});
		context.setDefaultTimeout(3*3600*1000);
		this.page = await context.newPage();
		this.page.setDefaultTimeout(3*3600 *1000);
		
		await this.page.addInitScript(async () => {
			delete window.navigator.serviceWorker;
			window.asleep = async function(ms) {
				return new Promise(resolve => setTimeout(resolve, ms));
			}
			window.addEventListener('unload', function () {
				document.documentElement.innerHTML = '';
			});
			window.getPartAttrs= (node,action)=> {
				let str;
				while (node.parentElement.id !== 'participants-ul') {
					node = node.parentElement;
				}
				var nameNode = document.evaluate('.//span[contains(@class,"participants-item__display-name")]', 
				node, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null );
				var name = nameNode.singleNodeValue.textContent;
				if (action == 'getname')
					return name;
				var labelNode = document.evaluate('.//span[contains(@class,"participants-item__name-label")]', 
				node, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null );
				var label = labelNode.singleNodeValue.textContent;

				str = node.ariaLabel;
				if (str.includes(name))
					str = str.replace(name,"");
				
				if (str.includes(label))
					str = str.replace(label,"");

				
				let ret = {};
				ret['aria-label'] = node.ariaLabel;
				ret['name'] = name;
				ret['handup'] = str.includes(' hand raised');
				ret['unmuted'] = str.includes(' audio unmuted');
				ret['audioconnected'] = !str.includes('no audio connected');
				ret['videooff'] = str.includes("video off");
				ret['action'] = action;
				ret['me'] = label.includes("me") || label.includes("Me");
				if (!ret['me'])
					ret['node'] = node;

				return ret;
			};
			window.partListUlNode = null;
			window.partListObserver = new MutationObserver(async (mutationList,obs) => {
				var actlist = [];
				for (let mutationRecord of mutationList) {
					if (mutationRecord.type == 'childList'){
						for (var node of mutationRecord.removedNodes) {
							if (node.parentNode !==  window.partListUlNode)
								continue;
							actlist.push(getPartAttrs(node,'del'));								
							
						}
						for (var node of mutationRecord.addedNodes) {
							if (node.parentNode !==  window.partListUlNode)
								continue;
							actlist.push(getPartAttrs(node,'add'));
							
						}
						continue;
					}
					if (mutationRecord.target.parentNode !==  window.partListUlNode)
						continue;
					actlist.push(getPartAttrs(mutationRecord.target,'upd'));

				}
				if (!actlist.length)
					return;
				processPartList(actlist);
			});
			window.processPartList = (actlist) => { 
				let names = {}
				let actlisttmp = [];
				console.log("processPartList");
				for (var node of window.partListUlNode.children) {
					var name = getPartAttrs(node,'getname');
					if (!(name in names))
						names[name] = 1;
					else
						++names[name];
					if (actlist === null)
						actlisttmp.push(getPartAttrs(node,"add"));
				}
				if (actlist === null)
					actlist = actlisttmp;

				accounted4names = {};

				partBegin();				
				for (var pa of actlist) {
					if (pa['name'] in accounted4names)
						continue;
					accounted4names[pa['name']] = true;
					if (pa['me']) {
						partMe(pa);
						continue;
					}
					const del = names[pa['name']] != 1 || pa['action'] == 'del' || pa['unmuted'] || !pa['handup'];;
					if (del)
						partDel(pa['name']);
					else
						partAdd(pa['name']);
				}
				partEnd();
			};
			window.startPartListObserving = () => {
				console.log("starting part list observing");
				window.partListUlNode = window.document.getElementById('participants-ul');
				window.partListObserver.disconnect();
				partClear();
				processPartList(null);
				window.partListObserver.observe(window.partListUlNode,{
					attributeFilter:['aria-label'],
					attributeOldValue:true,
					attributes:true,childList:true, subtree:true})
				console.log("starting part list observing setup done");
			};
			window.stopPartListObserving = () => {
				console.log("stop part list observing ");
				window.partListObserver.disconnect();
				partClear();
			};
		});
		await this.page.route('**/*',(req)=> {
			if (["media","image","font","texttrack","manifest","other"].includes(req.request().resourceType())) {
			  return req.abort();
			}
			req.continue();
		});
		

		thispage[this.page] = this

		let self = this;
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
		await this.page.exposeBinding('partUpd', async ({ page } , current, old) => {
			await thispage[page].partUpd(current,old)
		});
		await this.page.exposeBinding('partListStatus', async ({ page } , begin) => {
			await thispage[page].partListStatus(begin)
		});
		
		this.ensure_meeting_entry();
		this.ensure_host_there_and_enter_name();
		this.ensure_stop_incomming_video();
		this.ensure_part_list_up();
		this.ensure_mic_disconnected();
		this.ensure_computer_audio_tab_closed();
		this.ensure_check_meeting_not_started();
		this.ensure_dialogs_dismissed();
		this.ensure_leave_url_goes_to_mainurl();
		if (!ZOOMSCRAPE)
			await this.page.goto(this.url.href);
		this.page.on('close',async (page)=>{
			delete thispage[page];
			this.setup_vars();
			await this.setup_page();
			
		});
		this.page.on('crash',(page)=>{
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
		this.videoon = true;
		this.audioconnected = true;
		this.hovertimer = null;
		this.part_list = new PartList();
	}

	async run() {
		if (ZOOMCONNECTURL) {
			await this.setup_browser();
			await this.setup_page();
		}
		this.part_list.create_web_server();
		if (TEST)
			this.part_list.test();
	}
};
browser = new Browser(url);
browser.run();
