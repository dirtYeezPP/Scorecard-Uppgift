printPlayers(getPlayers());

window.addEventListener('load', async () => { await printGameInfo(getPlayers()) })
document.querySelector('.showTotalsBtn').addEventListener('click', () => { showTotals(getPlayers()) })
document.querySelector('.saveGameBtn').addEventListener('click', () => { saveGame() })

// CREATE
document.querySelector('.addPlayer form')
    .addEventListener('submit', e => {
        e.preventDefault();

        const name = e.target.name.value.trim().replaceAll(/\s+/g, "_");
        const scores = []; // default score to 0 if not provided 

        if (!name) return alert("even ghosts have names bro cmon");
        addPlayer(name, scores);
    })


function addPlayer(name, scores) {
    if (!name) return console.log("even ghosts have names cmon bro");

    const player = { name, scores, id: "id_" + Date.now() }

    const players = getPlayers() || [];

    players.push(player);
    saveToStorage(players);
    //console.log(localStorage);
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
        increasePlayerScore.addEventListener('click', () => { increaseScore(players, player.id, court.id) }) // dunno what to send in here yet 
        const decreasePlayerScore = ce('button');
        decreasePlayerScore.innerText = '-';
        decreasePlayerScore.addEventListener('click', () => { decreaseScore(players, player.id, court.id) })

        playerScoreField.innerText = player.scores[court.id] || 0;


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

// RESET GAME / SAVE GAME --> NOT USED REALLY

function saveGame() {
    const currentGameInfo = localStorage.getItem('List');
    console.log("currentGameInfo: ", currentGameInfo);
    saveToSavedGames(currentGameInfo);
}

function loadSavedGame() {
    const savedGame = localStorage.getItem('SavedGames');
}



// SCORE CONTROL  

function increaseScore(players, id, courtId) {
    const player = players.find(p => p.id == id);

    if (player.scores[courtId] === undefined || player.scores[courtId] === null) player.scores[courtId] = 0;
    player.scores[courtId] += 1;

    saveToStorage(players);
    printGameInfo(players);
}

function decreaseScore(players, id, courtId) {
    const player = players.find(p => p.id == id);

    if (player.scores[courtId] === undefined || player.scores[courtId] === null) player.scores[courtId] = 0;
    if(!player.scores[courtId]) return; // if score is 0 or undefined, do nothing

    player.scores[courtId] -= 1;
    saveToStorage(players);
    printGameInfo(players);
}


function showTotals(players) {
    const scoreTotal = document.querySelector(".scoreTotal");
    const totalTitle = ce('h3');
    totalTitle.innerText = "Total Scores";

    scoreTotal.replaceChildren();
    scoreTotal.appendChild(totalTitle);

    for (let player of players) {
        const totalScoreForPlayerDiv = ce('div');
        const name = ce('h4');
        name.innerText = player.name;
        const totalScore = ce('p');
        totalScore.innerText = "Total Score for " + player.name + ": " + player.scores.reduce((acc, score) => acc + (score ?? 0), 0);

        totalScoreForPlayerDiv.appendChild(name);
        totalScoreForPlayerDiv.appendChild(totalScore);
        scoreTotal.appendChild(totalScoreForPlayerDiv);
    }

    const totals = players.map(p => ({ name: p.name, total: p.scores.reduce((acc, score) => acc + (score ?? 0), 0) }));
    // ?? prevents me from getting fucked by undefined or nulled values 

    const validPlayers = totals.filter(p => p.total > 0); // filter out players with total score of 0
    const winner = validPlayers.length > 0 ? validPlayers.reduce((min, p) => p.total < min.total ? p : min) : null; // find the player with the lowest total score among valid players
    // reduce here compares objects instead of crushing values into one 

    const winnerTitle = ce('h3');
        if(validPlayers.length === 0) {
        winnerTitle.innerText = "No one has a score bro NO ONE WINS!";
        scoreTotal.appendChild(winnerTitle);
        return scoreTotal;
    }

    const lowestScore = validPlayers.reduce((min, p) => p.total < min ? p.total : min, validPlayers[0].total); // find the lowest total score among valid players
    const winners = validPlayers.filter(p=>p.total === lowestScore); // find all players with the lowest total score

    if(winners.length > 1) {
        const winnerTitle = ce('h3');
        winnerTitle.innerText = "It's a tie between: " + winners.map(p => p.name).join(", ") + " with each their score being: " + lowestScore;
        scoreTotal.appendChild(winnerTitle);
        return scoreTotal;
    } else {
        winnerTitle.innerText = "Winner: " + winner.name + " with a total score of: " + winner.total;
    }

    scoreTotal.appendChild(winnerTitle);
    return scoreTotal;
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
    //console.log(card);
    return card;
}

function saveToStorage(data) {
    const json = JSON.stringify(data); // gör om nå till en sträng
    localStorage.setItem('List', json);
}

function saveToSavedGames(data) {
    const json = JSON.stringify(data);
    localStorage.setItem('SavedGames', json);
}

// this one isnt used yet 
async function getSavedGameInfo() {
    const jsonCard = await fetch("SavedGames.json");
    const card = await jsonCard.json();
    console.log(card);
    return card;
}

function getPlayers() {
    let list = localStorage.getItem('List');
    if (!localStorage.length) return [];
    list = JSON.parse(list);
    return list
}