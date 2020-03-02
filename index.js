import { getSkyblockAuctionForItem } from 'slothpixel/endpoints';
import Promise from 'Promise';
import numeral from 'numeraljs';

let currentTradeWindow;
let ourTotalValue = 0;
let theirTotalValue = 0;
let ourText = "Calculating...";
let theirText = "Calculating...";

const itemCache = {};
function getItemPrices(id) {
    if (id in itemCache) {
        return Promise.resolve(itemCache[id]);
    }
    return getSkyblockAuctionForItem(id).then(({ median_price }) => {
        itemCache[id] = median_price;
        ChatLib.chat(`1x ${id}: &6${median_price}`);
        return median_price;
    });
}

const disclaimer = 'Disclaimer: All items sold in the past 24h are counted towards the median prices, enchantments, hot potato books etc. are not taken into account!';

const ourSlots = [0, 1, 2, 3, 9, 10, 11, 12, 18, 19, 20, 21];
const theirSlots = [5, 6, 7, 8, 14, 15, 16, 17, 23, 24, 25, 26];

register('tick', () => {
    let inv = Player.getOpenedInventory();
    if (inv === undefined || !inv.getName().startsWith('You') || !inv.getStackInSlot(27).getName().includes("Coins transaction")) {
        currentTradeWindow = undefined;
        return;
    }

    const newItems = (ourSlots.concat(theirSlots)).map(slot => inv.getStackInSlot(slot).getName() + "x" + inv.getStackInSlot(slot).getStackSize());
    if (currentTradeWindow && newItems.every((name, index) => currentTradeWindow[index] === name)) {
        // We already have the trade window open and nothing has changed, no need to recalculate.
        return;
    }

    // We're inside of a trade window.
    currentTradeWindow = newItems;
    ChatLib.chat('&bA new trade window has opened!');
    ourText = "Calculating...";
    theirText = "Calculating...";
    ourTotalValue = 0;
    theirTotalValue = 0;

    let ourCount = 0;
    calculateTotalValue(inv, ourSlots, value => {
        ourTotalValue += value;
        ourCount++;

        if (ourCount === ourSlots.length) {
            // We've finished all of our requests, our value is now final.
            ChatLib.chat(`Finished calculating our total value: ${ourTotalValue}`);
            ourText = "Our total value is " + numeral(ourTotalValue).format('$0,0');
        }
    });

    let theirCount = 0;
    calculateTotalValue(inv, theirSlots, value => {
        theirTotalValue += value;
        theirCount++;

        if (theirCount === theirSlots.length) {
            // We've finished all of our requests, our value is now final.
            ChatLib.chat(`Finished calculating their total value: ${theirTotalValue}`);
            theirText = "Their total value is " + numeral(theirTotalValue).format('$0,0');
        }
    });
});

register("postGuiRender", () => {
    if (currentTradeWindow === undefined) return;

    if (Math.abs(ourTotalValue - theirTotalValue) < 15_000) {
        Renderer.colorize(2, 117, 36);
        Renderer.scale(2, 2);
        Renderer.drawString(ourText, 2, 2);
        Renderer.colorize(2, 117, 36);
        Renderer.scale(2, 2);
        Renderer.drawString(theirText, 2, 12);
    } else if (ourTotalValue > theirTotalValue) {
        Renderer.colorize(192, 3, 41);
        Renderer.scale(2, 2);
        Renderer.drawString(ourText, 2, 2);
        Renderer.colorize(2, 117, 36);
        Renderer.scale(2, 2);
        Renderer.drawString(theirText, 2, 12);
    } else {
        Renderer.colorize(2, 117, 36);
        Renderer.scale(2, 2);
        Renderer.drawString(ourText, 2, 2);
        Renderer.colorize(192, 3, 41);
        Renderer.scale(2, 2);
        Renderer.drawString(theirText, 2, 12);
    }
});

function calculateTotalValue(inv, slots, valueCallback) {
    slots.forEach(slot => {
        const item = inv.getStackInSlot(slot);

        let coinValue = /([0-9]+) coins/.exec(item.getName().removeFormatting())?.[1];

        if (coinValue) {
            console.log(`got coins with value ${coinValue} from ${item.getName()}`);
            valueCallback(parseInt(coinValue));
            return;
        }

        let id = item.getItemNBT()?.getTag("tag")?.getTag("ExtraAttributes")?.getString("id");
        if (id === undefined) {
            valueCallback(0);
            return;
        }

        getItemPrices(id).then(value => {
            valueCallback(value * item.getStackSize());
        })
    })
}