# rarwr

``` 
    // For every player we build a small object { name, total }.
    // "total" is the players score for the whole course. Holes they haven't
    // played yet get an estimated score based on how they did on the holes
    // they DID play.

    // Scores are saved with the hole id as the index (scores[1] = hole 1),
    // the same way increaseScore/decreaseScore write them.
    // If a player has no scores array at all, use an empty one.

    // work out how far over (or under) par the player usually is.
    // Example: 10 shots on holes worth par 8 in total --> ratio 1.25
    // If nothing is played yet we just assume they play exactly par (ratio 1).
``` 

``` js
// Helper to update both the score card and the live totals together
async function updateGameViews(players) {
    const gameInfo = await getGameInfo();
    printGameInfo(players);
    showTotals(players, gameInfo);
}

window.addEventListener('load', async () => { 
    await updateGameViews(getPlayers());
});

async function increaseScore(players, id, courtId) {
    const player = players.find(p => p.id == id);

    if (player.scores[courtId] === undefined || player.scores[courtId] === null) player.scores[courtId] = 0;
    player.scores[courtId] += 1;

    saveToStorage(players);
    await updateGameViews(players); // Updates totals live
}

async function decreaseScore(players, id, courtId) {
    const player = players.find(p => p.id == id);

    if (player.scores[courtId] === undefined || player.scores[courtId] === null) player.scores[courtId] = 0;
    if (!player.scores[courtId]) return;

    player.scores[courtId] -= 1;
    saveToStorage(players);
    await updateGameViews(players); // Updates totals live
}

async function addPlayer(name, scores) {
    if (!name) return console.log("even ghosts have names cmon bro");

    const player = { name, scores, id: "id_" + Date.now() };
    const players = getPlayers() || [];

    players.push(player);
    saveToStorage(players);
    printPlayers(players);
    await updateGameViews(players); // Updates totals live
}

async function removePlayer(id) {
    const players = getPlayers();
    const newPlayerList = players.filter(p => p.id != id);
    if (players.length == newPlayerList.length) console.log("no player removed");
    saveToStorage(newPlayerList);
    printPlayers(newPlayerList);
    await updateGameViews(newPlayerList); // Updates totals live
}

async function loadSavedGame(gameData) {
    saveToStorage(gameData);
    printPlayers(gameData);
    await updateGameViews(gameData); // Updates totals live
}

// DELETE OR COMMENT OUT THIS LISTENER
/*
document.querySelector('.showTotalsBtn').addEventListener('click', async () => {
    const gameInfo = await getGameInfo();
    showTotals(getPlayers(), gameInfo);
});
*/
```



## en pytteliten del av matte 5 
i.e. vi har en array så let arr = [1,1,3,3,5,5,6]
låt säga de antal spelade hål för varje spelare yuh så 2 har kört 1 och så vidare 
kan man konvertera detta nope 

SET nu i js 
datastruktur 
det är en mängd, den vill inte ha dubletter den räknar bara vilka tal som finns 
det behöver inte skrivas 2 gånger dvs, de bara en uppräkning av innehåll som finns 
skapar ett set 
let s = new Set()
--> set(0) den har ingen length utan den har size 
inte superofta som det behövs men ändå
loop through 
arr.foreach(num=>s.add(num))
då har vi fått en ny lista med bara unika element, tal i vårt fall då
det innebr att när vi får den, utifrån en array kan vi alltid konstruera ett set med en loop
om det innehåller flera sajer (settet), säg alla har spelat 5 rundor så kommer settet bara ha en sak. 
vi kan använda den för att se olikhet i antal spelade hål liksom
vi kan konvertera till set och kolla dess storlek, säg 1 --> alla har spelat lika många hål! men om det inte är så... då vill vi hitta den största 
s.sort() --> går ej, ej kopplat till set, de sorteras ej
let sorted = Array.from(s).sort() --> now we can sort it yes --> gives array 
då kan vi också ta sorted.pop( ) ta ut den sista och få det största värdet och vi vet hur många rundor vi vill expecta att alla har spelat! så de är de med i resultat winner grejen eller inte. 

``` js
// NOT USED
/* async function getSavedGameInfo() {
    const jsonCard = await fetch("SavedGames.json");
    const card = await jsonCard.json();
    console.log(card);
    return card;
} */ 
```

``` js
/* document.querySelector('.showTotalsBtn').addEventListener('click', async () => {
    const gameInfo = await getGameInfo();
    showTotals(getPlayers(), gameInfo);
}); */ 
```

``` js
//window.addEventListener('load', async () => { await printGameInfo(getPlayers()) }) 
``` 
