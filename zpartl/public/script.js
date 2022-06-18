var socket = io();
var cards = document.querySelectorAll('.container > div');
var cardsOldInfo = {};
var cardsNewInfo = cardsOldInfo;
let container = document.querySelector(".container")
window.addEventListener('unload', function () {
    document.documentElement.innerHTML = '';
});

socket.on('putName', (nameobj) => {
	console.log("putName::"+ nameobj.name);
	put_card(nameobj.name,nameobj.id);
});

socket.on('removeNameId', (id) => {
	remove_card_by_id(id);
});

socket.on('changeName', (id) => {
	let card = document.getElementById("card_"+id);
	
});

socket.on('clearAll', () => {
	while (container.firstChild) {
	  container.removeChild(container.lastChild)
	}	
});

function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
}


const getTextWidth = (text, font) => {

  const element = document.createElement('canvas');
  const context = element.getContext('2d');
  context.font = font;
  return context.measureText(text).width;
}
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const min_eye_angle = urlParams.get('eyeangle') || .12;
const screen_distance = urlParams.get('dist') || 2*12;
const screen_diameter = urlParams.get('dia') ||10;
var font_xheight = .54;
const max_shrink_factor = .6;
const max_grow_factor = 1.2;
var px_height;
const no_background = urlParams.has('nb');
if (!no_background) {
	document.body.style.background = "linear-gradient(45deg, #f64f59, #c471ed, #12c2e9)";
}
function recalc_font_height() {
	/* let dpi_x = window.dpi_x;
	let dpi_y = window.dpi_y;
	let devicePixelRatio = window.devicePixelRatio; */
	// Calculate the height of name font div elements.
	// const elem = document.querySelector('.beautiful > div');
	// const style = getComputedStyle(elem);
	// const metrics = FontMetrics({fontFamily:style.fontFamily});
	px_height = screen_distance;
	px_height *= Math.tan(min_eye_angle * Math.PI / 180);
	px_height *= Math.pow(window.screen.width,2) + Math.pow(window.screen.height,2);
	
	px_height /= window.screen.height;
	px_height /= screen_diameter;
	px_height /= font_xheight;
	px_height /= window.innerHeight;
	px_height /= window.devicePixelRatio;
	px_height = (px_height* 100)+"vh";
	container.style.setProperty('--name-height', px_height);
	container.style.setProperty('--name-height-mult', 1);
	
}
window.addEventListener('resize', function(event){
	recalc_font_height();
});
function put_card(name,id) {
	id = "card_" + id;
	cardsOldInfo = getCardsInfo();

	const first_node = !container.hasChildNodes();
	if (first_node)
		recalc_font_height();
	let mult = container.style.getPropertyValue('--name-height-mult');

	var card = document.getElementById(id);
	if (!card)
		card = document.createElement('div');
	card.id = id;
	container.appendChild(card);
	css = getComputedStyle(card);
	let y = 4;
	let x = y/2;
	let p = (100 - 2 * y);
	let r = (100 - 2 * x);
	let q = Number.parseFloat(px_height) * p/100 * mult;
	q += "vh";
	const fsz = getTextWidth(name,css.font) *r/100;
	

	card.style.flexBasis = (fsz * max_shrink_factor * mult) + "px";
	card.style.flexSize = px_height;
	card.style.display = "flex";
	card.style.maxWidth = (fsz * max_grow_factor) + "px";
	
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

	
	let new_svg_text =  htmlToElement(`
<svg class="text" xmlns='http://www.w3.org/2000/svg' preserveAspectRatio="none"
style="width:100%;height:100%;">
  <g>
  <text font-size='${q}' x="${x}" y="${y}%" textLength="100%" alignment-baseline="hanging" lengthAdjust="spacingAndGlyphs" >
    ${name}
  </text>
  </g>
</svg>
	`);

	while (card.firstChild) {
		card.removeChild(card.lastChild);
	}
	card.appendChild(new_svg_text);
	cardsNewInfo = getCardsInfo();
	moveCards(card);
}


function removeCard(card) {
  cardsOldInfo = getCardsInfo();
  card.parentNode.removeChild(card);
  cardsNewInfo = getCardsInfo();
  moveCards();
}

function remove_card_by_id(id) {
	let card = document.getElementById("card_"+id);
	if (card)
		removeCard(card);
}

function getCardsInfo() {
  updateCards();
  let cardsInfo = {};
  cards.forEach(card => {
    var rect = card.getBoundingClientRect();
    cardsInfo[card.id] = {
      "x": rect.left,
      "y": rect.top,
      "width": rect.right - rect.left,
      "height": rect.bottom - rect.top, 
	  "scaleheight": container.style.getPropertyValue('--name-height-mult'),
	  };

  });
  return cardsInfo;
}

function moveCards(new_card) {
	updateCards();
	cards.forEach(card => {
		if (new_card === card) {
			
			card.animate([
			{ opacity: 0 , transform:`scaleY(0) scaleX(.5)`, 'transform-origin':'right'},
			{ opacity: 1, transform:`scaleY(1) scaleX(1)`, 'transform-origin':'right' },
			
			],
			{
				duration: 500,
				easing: 'cubic-bezier(0.42, 0.0, .9, 1.5)'
			});
		}
		else {
			card.animate([
			{ transform: `translate(${cardsOldInfo[card.id].x - cardsNewInfo[card.id].x}px,`+
			` ${cardsOldInfo[card.id].y - cardsNewInfo[card.id].y}px) `+
			`scaleX(${cardsOldInfo[card.id].width / cardsNewInfo[card.id].width})` },
			{ transform: 'none' }],
			{
				duration: 500,
				easing: 'ease-out' 
			});
		}
	});
}

function updateCards() {
  cards = document.querySelectorAll('.container > div');
}