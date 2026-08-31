const fs = require('fs');
let code = fs.readFileSync('pages/api/workflows/[id]/stats.ts', 'utf8');

const sqlAnchor = `        (SELECT COUNT(DISTINCT target_id) FROM logs
          WHERE run_id IN (\${RUNS}) AND message LIKE 'Email sent%') AS emails_sent
      FROM run_profiles rp`;

const sqlReplacement = `        (SELECT COUNT(DISTINCT target_id) FROM logs
          WHERE run_id IN (\${RUNS}) AND message LIKE 'Email sent%') AS emails_sent,
        (SELECT COUNT(DISTINCT target_id) FROM logs
          WHERE run_id IN (\${RUNS}) AND message LIKE 'Visited %') AS profiles_visited,
        (SELECT COUNT(DISTINCT target_id) FROM logs
          WHERE run_id IN (\${RUNS}) AND message LIKE 'Email enriched via %') AS emails_enriched,
        (SELECT COUNT(DISTINCT target_id) FROM logs
          WHERE run_id IN (\${RUNS}) AND message LIKE 'Successfully pushed % to HubSpot CRM') AS hubspot_pushes
      FROM run_profiles rp`;

code = code.replace(sqlAnchor, sqlReplacement);

const typeAnchor = `      inmails_sent: number;
      emails_sent: number;
    };`;

const typeReplacement = `      inmails_sent: number;
      emails_sent: number;
      profiles_visited: number;
      emails_enriched: number;
      hubspot_pushes: number;
    };`;

code = code.replace(typeAnchor, typeReplacement);

const returnAnchor = `      inmails_sent: counts.inmails_sent ?? 0,
      emails_sent: counts.emails_sent ?? 0,
      active_run: activeRun ?? null,
    });`;

const returnReplacement = `      inmails_sent: counts.inmails_sent ?? 0,
      emails_sent: counts.emails_sent ?? 0,
      profiles_visited: counts.profiles_visited ?? 0,
      emails_enriched: counts.emails_enriched ?? 0,
      hubspot_pushes: counts.hubspot_pushes ?? 0,
      active_run: activeRun ?? null,
    });`;

code = code.replace(returnAnchor, returnReplacement);

fs.writeFileSync('pages/api/workflows/[id]/stats.ts', code);
