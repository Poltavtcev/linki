const fs = require('fs');
let code = fs.readFileSync('pages/api/targets/index.ts', 'utf8');

const anchor = `        case "not_contacted":
        expr = "t.connection_requested_at IS NULL AND t.message_sent_at IS NULL";
        break;
      case "enriched":
        expr = "(t.enriched_at IS NOT NULL OR t.apollo_enriched_at IS NOT NULL OR EXISTS (SELECT 1 FROM logs l WHERE l.target_id = t.id AND (l.message LIKE 'Email enriched via %' OR l.message LIKE '%to HubSpot%')))";
        break;
      case "hubspot":
        expr = "EXISTS (SELECT 1 FROM logs l WHERE l.target_id = t.id AND l.message LIKE '%to HubSpot%')";
        break;
      default:
        expr = "t.connection_requested_at IS NULL AND t.message_sent_at IS NULL";
      }
      if (f.op === "is_not") expr = \`NOT (\${expr})\`;
      parts.push(expr);
      continue;
    }`;

const replacement = `        case "not_contacted":
        default:
          expr = "t.connection_requested_at IS NULL AND t.message_sent_at IS NULL";
      }
      if (f.op === "is_not") expr = \`NOT (\${expr})\`;
      parts.push(expr);
      continue;
    }

    if (f.field === "enriched") {
      let expr = "(t.enriched_at IS NOT NULL OR t.apollo_enriched_at IS NOT NULL OR EXISTS (SELECT 1 FROM logs l WHERE l.target_id = t.id AND (l.message LIKE 'Email enriched via %' OR l.message LIKE '%to HubSpot%')))";
      if (f.op === "is_not_set") expr = \`NOT (\${expr})\`;
      parts.push(expr);
      continue;
    }

    if (f.field === "hubspot") {
      let expr = "EXISTS (SELECT 1 FROM logs l WHERE l.target_id = t.id AND l.message LIKE '%to HubSpot%')";
      if (f.op === "is_not_set") expr = \`NOT (\${expr})\`;
      parts.push(expr);
      continue;
    }`;

code = code.replace(anchor, replacement);
fs.writeFileSync('pages/api/targets/index.ts', code);
