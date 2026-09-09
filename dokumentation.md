# DOKUMENTATION 
this documentation is for educational purposes only. 

<hr>

## 1 HTML AND VIEW "RENDERING"
### 1.1 HTML CODE 
``` html 
    <main>
        <details class="addPlayer">
            <summary>Player details</summary>
            <form action="" method="get">
                <input type="text" name="name" placeholder="players name">
                <input type="submit" value="addPlayer">
            </form>
            <div class="players">

            </div>
        </details>
        <p class="whisperText">scroll horizontally to see all players</p>

        <div class="scoreTableDyn">

        </div>

        <div class="scoreTotal">

        </div>

        <button class="saveGameBtn">Save Game</button>
        <button class="startNewGameBtn">Start New Game</button>

        <details class="savedGamess">
            <summary>Saved Games</summary>
            <div class="savedGames">

            </div>
        </details>
    </main>
```
The HTML file includes sections of the tag "details" which are used when displaying something a player can open and close on demand. 
This works without the implementation of javascript. 
There are also a lot of empty box-elements included, which take care of data taken in from javascript in later scenarios. The javascript builds up the page (*see 1.2 JAVASCRIPT HTML FUNCTIONS*). 

<hr>

### 1.2 JAVASCRIPT HTML FUNCTIONS
A lot of whats visible within the page is created with javascript (*see 3.2 CREATE ELEMENT* or *1.2a OUTPUTTING PLAYERS*).
#### 1.2a OUTPUTTING PLAYERS 
``` js 
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
``` 

``` js
function printPlayers(players) {
    const playersBox = document.querySelector('.players');
    playersBox.replaceChildren();
    for (let player of players) {
        playersBox.appendChild(playerInHtml(player));
    }
}
```
#### 1.2b OUTPUTTING GAME INFO 
``` js 
function gameInfoHtml(court, players) {
    const infoDiv = ce('tr');
    infoDiv.classList.add('info');
    infoDiv.id = "courtId_" + court.id;

    const parNum = ce('td')
    parNum.innerText = court.par;

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
        decreasePlayerScore.addEventListener('click', () => { decreaseScore(players, player.id, court.id, court.par) })

        const scoreSpan = ce('span');
        scoreSpan.innerText = player.scores[court.id] || 0;
        scoreSpan.style.margin = "0 6px";

        playerScoreField.appendChild(decreasePlayerScore);
        playerScoreField.appendChild(scoreSpan);
        playerScoreField.appendChild(increasePlayerScore);
        infoDiv.appendChild(playerScoreField);
    }
    return infoDiv;
}
``` 

``` js
async function printGameInfo(players) {
    let gameInfo = await getGameInfo();

    const infoBox = document.querySelector(".scoreTableDyn");
    infoBox.replaceChildren();

    const courtTitleRow = ce('tr');

    const parTitle = ce('th');
    parTitle.innerText = "par"

    const courtTitle = ce('th');
    courtTitle.innerText = "Hål";

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

    for (let court of gameInfo.court) {
        table.appendChild(gameInfoHtml(court, players));
    }
}
```
#### 1.2c OUTPUTTING SCORES 
``` js 

``` 
#### 1.2d OUTPUTTING SAVED GAMES 
``` js 
function displaySavedGames() {
    const savedGamesDiv = document.querySelector(".savedGames");
    savedGamesDiv.replaceChildren();

    // loop through localStorage and find all saved games fr
    // i = o then it keeps going if its less than the lenght --> ++ is +=1 basically rawr
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i); //ts wikll hopefully never be null yes

        // filtrera bort orelevanta spel basically 
        if (!key.startsWith("game_")) {
            continue;
        }

        const rawData = localStorage.getItem(key); // get the value of the item in localStorage with the key

        // parse json om savedata = objekt , annars string fr 
        let gameData;
        try {
            gameData = JSON.parse(rawData); // if the data is a valid JSON string w object, parse it into an object
        } catch {
            gameData = rawData;
        }

        const singleGameDiv = ce("div");
        singleGameDiv.classList.add("savedGameItem");
        const savedGameTitle = ce("h4");
        //savedGameTitle.innerText = typeof gameData === "object" ? (gameData[1].name || key) : key;
        savedGameTitle.innerText = key.replace("game_", "");
        // array is an object because javascript  
        // if object --> fetches first object in array (.name gives name yes), if name not defined --> key 
        // if not object --> key after : 

        const loadGameButton = ce("button");
        loadGameButton.innerText = "load Game";
        loadGameButton.addEventListener("click", () => {
            //console.log(`loading for ${key}`, gameData)
            loadSavedGame(gameData);
        });
        const deleteSavedGameButton = ce("button");
        deleteSavedGameButton.innerText = "delete game";
        deleteSavedGameButton.addEventListener("click", () => {
            deleteSavedGame(gameData);
        });

        singleGameDiv.appendChild(savedGameTitle);
        singleGameDiv.appendChild(loadGameButton);
        singleGameDiv.appendChild(deleteSavedGameButton);
        savedGamesDiv.appendChild(singleGameDiv);
    }
    return savedGamesDiv;
}
``` 
## 2 JAVASCRIPT
### 2.1 PLAYERS 
#### ADD A PLAYER
In order to add a player the existent input field in HTML is used for retrieving data upon player creation. 
``` js 
document.querySelector('.addPlayer form')
    .addEventListener('submit', e => {
        e.preventDefault();

        const name = e.target.name.value.trim().replaceAll(/\s+/g, "_");
        const scores = []; // default score to 0 if not provided 

        if (!name) return alert("even ghosts have names bro cmon");
        addPlayer(name, scores);
    })
```
All players shall have a name, which is achieved by alerting the user when the input field is not written in. Each player is then initiated with a name and an array which will contains the scores obtained in each hole (0-17 represents 18 courses/holes). 

``` js
async function addPlayer(name, scores) {
    if (!name) return console.log("even ghosts have names cmon bro");

    const player = { name, scores, id: "id_" + Date.now() }

    const players = getPlayers() || [];

    players.push(player);
    saveToStorage(players);
    printPlayers(players);
    await updateGameViews(players); 
}
```
The *addPlayer* function receives the values from the input field sent in earlier.
Yet again the program checks if a name is given, and otherwise alerts the user that a name is required for the added player. 
A player is then created with the obtained values and an added field of id which includes the function *Date.now()*. 
All players are then retrieved from the *getPlayers* function, if there is no player the result will be an empty array. 
The players list then gets the current player inserted into it, which is then saved to local storage and sent to the *printPlayers* function. 
Await ensures that our program will not kill itself if the result of *updateGameViews* is not yet retrieved. 

#### REMOVE PLAYER 
``` js
async function removePlayer(id) {
    const players = getPlayers();
    const newPlayerList = players.filter(p => p.id != id);
    if (players.length == newPlayerList.length) console.log("no player removed");
    saveToStorage(newPlayerList);
    printPlayers(newPlayerList);
    await updateGameViews(newPlayerList);
}
```

### 2.2 PLAYER SCORE CONTROLS 
#### 2.2a INCREASE PLAYER SCORE 
``` js 
async function increaseScore(players, id, courtId) {
    const player = players.find(p => p.id == id);

    if (player.scores[courtId] === undefined || player.scores[courtId] === null) player.scores[courtId] = 0;
    player.scores[courtId] += 1;

    saveToStorage(players);
    await updateGameViews(players);
}
``` 

#### 2.2b DECREASE PLAYER SCORE 
``` js 
async function decreaseScore(players, id, courtId) {
    const player = players.find(p => p.id == id);

    if (player.scores[courtId] === undefined || player.scores[courtId] === null) player.scores[courtId] = 0;
    if (!player.scores[courtId]) return;

    player.scores[courtId] -= 1;
    saveToStorage(players);
    await updateGameViews(players);
}
``` 

#### 2.2c SHOW TOTALS ON TO THE PAGE 
``` js 
function showTotals(players, gameInfo) {
    const scoreTotal = document.querySelector(".scoreTotal");
    if (!scoreTotal) return null;
    const totalTitle = ce('h3');
    totalTitle.innerText = "Total Scores";

    scoreTotal.replaceChildren(totalTitle);
    const courtArray = gameInfo?.court || [];
    const playerStats = [];

    for (let player of players) { 
        const scores = player.scores || [];
        let playedScore = 0;
        let playedPar = 0;
        let playedHoles = 0;

        for (let hole of courtArray) {
            const score = scores[hole.id];
            if (score > 0) {
                playedScore += score;
                playedPar += hole.par;
                playedHoles++;
            }
        }
 
        let ratio = 1;
        if (playedPar > 0) {
            ratio = playedScore / playedPar;
        }
 
        let total = 0;

        for (let hole of courtArray) {
            const score = scores[hole.id];
            if (score > 0) {
                total += score;
            } else {
                total += Math.round(hole.par * ratio);
            }
        }

        playerStats.push({ name: player.name, total: total, playedHoles: playedHoles });
    }

    for (let player of playerStats) {
        const totalScoreForPlayerDiv = ce('div');
        const name = ce('h4');
        name.innerText = player.name;
        const totalScore = ce('p');
        totalScore.innerText = `Total score for ${player.name} : ${player.total}`;

        totalScoreForPlayerDiv.appendChild(name);
        totalScoreForPlayerDiv.appendChild(totalScore);
        scoreTotal.appendChild(totalScoreForPlayerDiv);
    }

    const validPlayers = playerStats.filter(p => p.playedHoles > 0);  
    const winnerTitle = ce('h3');

    if (validPlayers.length === 0) {
        winnerTitle.innerText = "No valid scores are recorded"
    } else {
        const lowestScore = Math.min(...validPlayers.map(p => p.total));
        
        const winners = validPlayers.filter(p => p.total === lowestScore); 
        if (winners.length > 1) {
            winnerTitle.innerText = `It's a tie between ${winners.map(p => p.name).join(", ")} with each their score being: ${lowestScore}`;
        } else {
            winnerTitle.innerText = `Winner: ${winners[0].name} with a total score of:  + ${winners[0].total}`;
        }
    }
    scoreTotal.appendChild(winnerTitle);
    return scoreTotal;
}
``` 


### 2.3 GAME CONTROLS 
#### 2.3a SAVE GAME FUNCTION
``` js 
function saveGame() {
    const currentGameInfo = localStorage.getItem('List');
    saveGameToLocalStorage(currentGameInfo);
}
``` 
#### 2.3b LOAD THE SAVED GAME INFO 
``` js
async function loadSavedGame(gameData) {
    console.log(gameData);
    saveToStorage(gameData);
    printPlayers(gameData);
    await updateGameViews(gameData)
}
```
#### 2.3c START NEW GAME 

``` js
function startNewGame() {
    if (!confirm("Are you sure you want to start a new game?")) {
        return;
    }
    let players = getPlayers();
    for (let p of players) {
        p.scores = [];
    }
    loadSavedGame(players);
}
```

<hr>

## 3 HELPER SECTION IN CLIENT.JS 
### 3.1 FETCHING & LOCALSTORAGE 
#### 3.1a LOCALSTORAGE SAVING 
``` js 
function saveToStorage(data) {
    const json = JSON.stringify(data); // gör om nå till en sträng
    localStorage.setItem('List', json);
}
``` 

##### SAVE GAME TO LOCAL STORAGE 
``` js
function saveGameToLocalStorage(data) {
    let nameOfGame = null;
    while (true) {
        const input = prompt("Name your game: ")
        if (input === null) {
            return;
        }
        const trimName = input.trim();
        if (trimName.length > 0) {
            nameOfGame = trimName;
            break;
        }
        alert("even ghosts name their games bro cmon");
    }
    localStorage.setItem(`game_${nameOfGame}`, data);
}
```

#### 3.1b GAMEINFO 
``` js 
async function getGameInfo() {
    const jsonCard = await fetch("info.json");
    const card = await jsonCard.json();
    return card;
}
``` 
##### TOTAL SCORES HELPER
``` js
async function updateGameViews(players) {
    const gameInfo = await getGameInfo();
    printGameInfo(players);
    showTotals(players, gameInfo);
}
```

#### 3.1c PLAYERS 
``` js 
function getPlayers() {
    let list = localStorage.getItem('List');
    if (!localStorage.length) return [];
    list = JSON.parse(list);
    return list
}
``` 


### 3.2 CREATE ELEMENT 
``` js 
function ce(elementType, className = null) {
    const el = document.createElement(elementType);
    if (className) el.classList.add(className);
    return el;
}

``` 
