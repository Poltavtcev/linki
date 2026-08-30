import { getDb } from "../lib/db";
import { syncLinkedInInboxReadOnly } from "../lib/linkedin/inbox-sync";
import { LinkedInNetworkObserver } from "../lib/linkedin/inbox-observer";

async function main() {
  const db = getDb();
  const account = db.prepare("SELECT id FROM accounts WHERE is_authenticated = 1 LIMIT 1").get() as { id: string } | undefined;
  
  if (!account) {
    console.error("No authenticated account found.");
    process.exit(1);
  }

  console.log(`Starting forced LinkedIn inbox sync for account ${account.id}...`);
  
  try {
    const syncResult = await syncLinkedInInboxReadOnly({ 
      accountId: account.id, 
      source: new LinkedInNetworkObserver() 
    });
    
    console.log(`Sync complete! Captured ${syncResult.captured} new replies. Duplicates: ${syncResult.duplicates}`);
    if (syncResult.skipped && syncResult.skipped.length > 0) {
      console.log(`Skipped ${syncResult.skipped.length} messages. Reasons:`);
      for (const skip of syncResult.skipped) {
        console.log(`- ${JSON.stringify(skip)}`);
      }
    }
    
    // Now check if it's in the DB
    const targetUrl = "https://www.linkedin.com/in/poltavcev/";
    const target = db.prepare("SELECT id FROM targets WHERE linkedin_url LIKE ?").get(`%${targetUrl}%`) as { id: string };
    
    const messages = db.prepare("SELECT id, text, created_at, ai_classification FROM linkedin_messages WHERE target_id = ? ORDER BY created_at DESC").all(target.id) as any[];
    
    console.log(`\nFound ${messages.length} messages for target in DB.`);
    for (const msg of messages.slice(0, 3)) {
      console.log(`- [${msg.created_at}] ${msg.text.substring(0, 50)}... (Classification: ${msg.ai_classification || 'None'})`);
    }

  } catch (err) {
    console.error("Sync failed:", err);
  }
}

main().catch(console.error);
