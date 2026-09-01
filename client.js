printPlayers(getPlayers());

window.addEventListener('load', async () => { await printGameInfo(getPlayers()) })

// CREATE
document.querySelector('.addPlayer form')
    .addEventListener('submit', e => {
        e.preventDefault();

        const name = e.target.name.value.trim().replaceAll(/\s+/g, "_"); 
        const score = [0]; // default score to 0 if not provided 

        if (!name) return alert("even ghosts have names bro cmon");
        addPlayer(name, score);
    })

function addPlayer(name, score) {
    if (!name) return console.log("even ghosts have names cmon bro");

    const player = { name, score, id: "id_" + Date.now() }

    const players = getPlayers() || [];

    players.push(player);
    saveToStorage(players);
    console.log(localStorage);
    //printPlayers([player]);
    printPlayers(players);
    printGameInfo(players)
}


// READ GAME INFO 

function gameInfoHtml(court, players) {
    const infoDiv = ce('tr');
    infoDiv.classList.add('info');
    infoDiv.id = "courtId_" + court.id;

    const parNum = ce('td')
    parNum.innerText = "hål: " + court.par;

    const courtNum = ce('td')
    courtNum.innerText = court.id;

    infoDiv.appendChild(courtNum);
    infoDiv.appendChild(parNum);


    for (let player of players) {
        const playerScoreField = ce('td');
        const increasePlayerScore = ce('button'); 
        increasePlayerScore.innerText = '+';
        increasePlayerScore.addEventListener('click', ()=>{ increaseScore(players, player.id, court.id) }) // dunno what to send in here yet 
        const decreasePlayerScore = ce('button'); 
        decreasePlayerScore.innerText = '-';
        decreasePlayerScore.addEventListener('click', ()=>{ decreaseScore(players, player.id, court.id) })  

        playerScoreField.innerText = player.score || 0;
        
  
        playerScoreField.appendChild(increasePlayerScore);
        playerScoreField.appendChild(decreasePlayerScore); 
        infoDiv.appendChild(playerScoreField);
    }

    return infoDiv;
}

async function printGameInfo(players) {
    let gameInfo = await getGameInfo();

    const infoBox = document.querySelector(".scoreTableDyn");

    infoBox.replaceChildren();

    const courtTitleRow = ce('tr');

    const parTitle = ce('th');
    parTitle.innerText = "par"

    const courtTitle = ce('th');
    courtTitle.innerText = "court";

    courtTitleRow.appendChild(courtTitle);
    courtTitleRow.appendChild(parTitle)

    const table = ce('table');
    table.appendChild(courtTitleRow);
    infoBox.appendChild(table);


    for (let player of players) {
        const playerTitle = ce('th')
        playerTitle.innerText = player.name;
        courtTitleRow.appendChild(playerTitle);
    }

    //infoBox.replaceChildren();
    for (let court of gameInfo.court) {
        table.appendChild(gameInfoHtml(court, players));
    }
}

// SCORE CONTROL - NOT SURE WHAT TO DO HERE YET. 

function increaseScore(players, id, courtId){

    const player = players.find(p => p.id == id);

    player.score += 1; 
     
    saveToStorage(players);
    printGameInfo(players);
    
}

function decreaseScore(players, id, courtId){

    const player = players.find(p => p.id == id);
    if(player.score == 0) return; 
    player.score -= 1;
    saveToStorage(players);
    printGameInfo(players);

}   

// READ PLAYERS 

/**
 * 
 * @param {object} player 
 * 
 */

function playerInHtml(player) {
    const div = ce('div');
    div.classList.add('player');
    div.id = player.id;

    const title = ce('h3');
    title.innerText = player.name;

    const rmButton = ce('button');
    rmButton.innerText = "remove"
    rmButton.addEventListener('click', () => { removePlayer(player.id) })

    div.appendChild(title);
    div.appendChild(rmButton);
    return div;
}

function printPlayers(players) {
    const playersBox = document.querySelector('.players');
    playersBox.replaceChildren();
    for (let player of players) {
        playersBox.appendChild(playerInHtml(player));
    }
}

// UPDATE SCORES 


// DELETE 
function removePlayer(id) {
    const players = getPlayers();
    const newPlayerList = players.filter(p => p.id != id);
    if (players.length == newPlayerList.length) console.log("no player removed");
    saveToStorage(newPlayerList);
    //document.getElementById(id).remove();
    printPlayers(newPlayerList);
    printGameInfo(newPlayerList);
}

// HELPER FUNCTIONS 


// CREATE ELEMENT 
function ce(elementType, className = null) {
    const el = document.createElement(elementType);
    if (className) el.classList.add(className);
    return el;
}

// GET SCORE CARD ROUNDS FROM JSON FILE 
async function getGameInfo() {
    const jsonCard = await fetch("info.json");
    const card = await jsonCard.json(); //automatic JsonParse if you will 
    console.log(card);
    return card;
}

function saveToStorage(data) {
    const json = JSON.stringify(data);
    localStorage.setItem('List', json);
}

function getPlayers() {
    let list = localStorage.getItem('List');
    if (!localStorage.length) return [];
    list = JSON.parse(list);
    return list
}