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
