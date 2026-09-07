printPlayers(getPlayers());

window.addEventListener('load', async () => { await printGameInfo(getPlayers()) })

document.querySelector('.showTotalsBtn').addEventListener('click', async () => { 
    const gameInfo = await getGameInfo(); 
    showTotals(getPlayers(), gameInfo); 
});

document.querySelector('.saveGameBtn').addEventListener('click', () => { saveGame() })
document.querySelector('.startNewGameBtn').addEventListener('click', () => { startNewGame() })


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
    parNum.innerText = "avg slag: " + court.par;

    const courtNum = ce('td')
    courtNum.innerText = "Hål:" + court.id;

    infoDiv.appendChild(courtNum);
    infoDiv.appendChild(parNum);


    for (let player of players) {
        const playerScoreField = ce('td');
        const increasePlayerScore = ce('button');
        increasePlayerScore.innerText = '+';
        increasePlayerScore.addEventListener('click', () => { increaseScore(players, player.id, court.id) }) // dunno what to send in here yet 
        const decreasePlayerScore = ce('button');
        decreasePlayerScore.innerText = '-';
        decreasePlayerScore.addEventListener('click', () => { decreaseScore(players, player.id, court.id, court.par) })

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

function loadSavedGame(nameOfGame) {
    const savedGame = localStorage.getItem(nameOfGame);
}

function startNewGame() {

}

function showPreviousGames() {

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
    if (!player.scores[courtId]) return; // if score is 0 or undefined or null, do nothing

    player.scores[courtId] -= 1;
    saveToStorage(players);
    printGameInfo(players);
}


function showTotals(players, gameInfo) {
    const scoreTotal = document.querySelector(".scoreTotal");
    const totalTitle = ce('h3');
    totalTitle.innerText = "Total Scores";

    scoreTotal.replaceChildren();
    scoreTotal.appendChild(totalTitle);

    const courtArray = gameInfo?.court || [];
    // Optional chaining operator --> check if thing exists otherwise return undefined. 

    const playerStats = players.map(player => {
        let playedScoreTotes = 0;
        let playedParTote = 0;
        let estimatedScoreToteForPlayer = 0;

        // find total only for what theyve played 
        courtArray.forEach((hole, index) => {
            const currentPar = hole?.par ?? 0; 
            // kollar om ett par finns in the current object from array courtArray 
            // ?? prevents me from getting fucked by undefined or nulled values 
            const score = player.scores[index]; 

            if (score && score > 0  && currentPar > 0) {
                // checks if score exists / is greater than 0, otherwise jump to next hole 
                // check if currentpar actually has a value greater than +. 
                playedScoreTotes += score;
                playedParTote += currentPar;
            }
        })

        const overShootAverage = playedParTote > 0 ? (playedScoreTotes / playedParTote) : 1;
        // Check if holes are played, divide hits by expected par, default of 1 to not make ts thing crash tf out.

        courtArray.forEach((hole, index) => {
            const currentPar = hole?.par ?? 0;
            const score = player.scores[index]; 

            if (score && score > 0) {
                estimatedScoreToteForPlayer += score;
            } else if (currentPar > 0){
                // if they missed hole --> multiple par by overshootAverage, vi vill ha ett heltal --> round. 
                const estimatedScore = Math.round(currentPar * overShootAverage);
                estimatedScoreToteForPlayer += estimatedScore;
            }
        }); return {
            // were giving a brand new object to replace the old one 
            name: player.name, 
            total: estimatedScoreToteForPlayer
        }
    }); 

    for (let player of playerStats) {
        const totalScoreForPlayerDiv = ce('div');
        const name = ce('h4');
        name.innerText = player.name;
        const totalScore = ce('p');
        totalScore.innerText = "Total Score for " + player.name + ": " + player.total; 

        totalScoreForPlayerDiv.appendChild(name);
        totalScoreForPlayerDiv.appendChild(totalScore);
        scoreTotal.appendChild(totalScoreForPlayerDiv);
    }

    const validPlayers = playerStats.filter(p => p.total > 0); 

    const winnerTitle = ce('h3');
    const lowestScore = validPlayers.reduce((min, p) => p.total < min ? p.total : min, validPlayers[0].total); // find the lowest total score among valid players
    const winners = validPlayers.filter(p => p.total === lowestScore); // find all players with the lowest total score

    if (winners.length > 1) {
        winnerTitle.innerText = "It's a tie between: " + winners.map(p => p.name).join(", ") + " with each their score being: " + lowestScore;
        scoreTotal.appendChild(winnerTitle);
        return scoreTotal;
    } else {
        const winner = winners[0]
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
    const nameOfGame = prompt("Name your game: ");
    // vill att denna ska begära ett innehåll, dvs att tomt inte skall sparas. 
    localStorage.setItem(nameOfGame, json);
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