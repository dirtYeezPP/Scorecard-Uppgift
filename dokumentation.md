# SCORE CARD UPPGIFT DOCUMENTATION 
This documentation is purely for my own sake of learning. 

## LOCAL STORAGE 


## SPELARE 
### LÄGGA TILL SPELARE 
``` html 
        <div class="playerSection">
            <div class="players">

            </div>

            <div class="addPlayer">
                <form action="" method="get">
                    <input type="text" name="name" placeholder="players name">
                    <input type="submit" value="addPlayer">
                </form>
            </div>
        </div>
```
Den tomma diven används inom senare syften för att uppvisa alla spelare. 
Formuläret finns till för att möjliggöra tilläg av spelare. 

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

``` js 
function addPlayer(name, scores) {
    if (!name) return console.log("even ghosts have names cmon bro");

    const player = { name, scores, id: "id_" + Date.now() }

    const players = getPlayers() || [];

    players.push(player);
    saveToStorage(players);
    console.log(localStorage);
    //printPlayers([player]);
    printPlayers(players);
    printGameInfo(players)
}
``` 


### TA BORT SPELARE 
``` js 
``` 
### POÄNGKONTROLL 
#### INCREASE SCORE 
``` js 
``` 
#### DECREASE SCORE 
``` js 
``` 
#### SHOW TOTAL SCORE 
``` js 
```

## TABELL & SPELINFORMATION 
 

## HJÄLPARFUNKTIONER 
Dessa funktioner finns för lättare åstadkommelse vid behov. 
### CREATE ELEMENT 
``` js 
``` 
### GETGAMEINFO 
``` js 
``` 
### SAVETOSTORAGE 
``` js 
``` 
### GETPLAYERS 
``` js 
``` 