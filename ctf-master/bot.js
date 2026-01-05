const puppeteer = require('puppeteer');

// Defines the target cookie for the CTF challenge.
const FLAG_COOKIE = {
    name: 'admin_session',
    value: 'CTF{SVG_ist_maechtiger_als_gedacht}',
    domain: 'localhost',
};

// The URL to visit is passed as a command-line argument.
const urlToVisit = process.argv[2]; 
if (!urlToVisit) {
    console.error('❌ Fehler: Dem Bot wurde keine URL zum Besuchen übergeben.');
    process.exit(1);
}

// Visits a given URL with Puppeteer, sets a cookie, and waits briefly.
async function visitPage() {
    let browser;
    try {
        console.log('🤖 Bot startet den Besuch...');
        browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Set the admin cookie before visiting the page.
        await page.setCookie(FLAG_COOKIE);
        console.log('🍪 Admin-Cookie gesetzt.');

        console.log(`Besuche Seite: ${urlToVisit}`);
        await page.goto(urlToVisit, { timeout: 5000 });

        // Wait for a moment to allow any scripts on the page to execute.
        await new Promise(resolve => setTimeout(resolve, 2000)); 

        console.log('✅ Besuch abgeschlossen.');
    } catch (error) {
        console.error('Fehler beim Bot-Besuch:', error.message);
    } finally {
        if (browser) {
            await browser.close();
            console.log('🤖 Bot beendet.');
        }
    }
}

visitPage();
