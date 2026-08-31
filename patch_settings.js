const fs = require('fs');
let content = fs.readFileSync('pages/settings.tsx', 'utf8');

const oldIntegrations = `const INTEGRATIONS: IntegrationDef[] = [
  {
    key: "apollo",
    name: "Apollo.io",
    description: "B2B database for finding prospect emails and phone numbers",
    badge: "AP",
    badgeColor: "#4f46e5",
    accentColor: "#4f46e5",
    placeholder: "Apollo API key",
  },
  {
    key: "openrouter",`;

const newIntegrations = `const INTEGRATIONS: IntegrationDef[] = [
  {
    key: "hubspot",
    name: "HubSpot CRM",
    description: "Sync enriched contacts automatically to your HubSpot CRM",
    badge: "HS",
    badgeColor: "#ff7a59",
    accentColor: "#ff7a59",
    placeholder: "HubSpot Private App Token",
  },
  {
    key: "prospeo",
    name: "Prospeo",
    description: "Find professional emails from LinkedIn URLs",
    badge: "PR",
    badgeColor: "#3b82f6",
    accentColor: "#3b82f6",
    placeholder: "Prospeo API key",
  },
  {
    key: "apollo",
    name: "Apollo.io",
    description: "B2B database for finding prospect emails and phone numbers",
    badge: "AP",
    badgeColor: "#4f46e5",
    accentColor: "#4f46e5",
    placeholder: "Apollo API key",
  },
  {
    key: "hunter",
    name: "Hunter.io",
    description: "Find email addresses by name and company domain",
    badge: "HN",
    badgeColor: "#ff5252",
    accentColor: "#ff5252",
    placeholder: "Hunter API key",
  },
  {
    key: "skrapp",
    name: "Skrapp.io",
    description: "B2B email finder and lead extraction",
    badge: "SK",
    badgeColor: "#20c997",
    accentColor: "#20c997",
    placeholder: "Skrapp API key",
  },
  {
    key: "snov",
    name: "Snov.io",
    description: "Email finder and verification tool",
    badge: "SN",
    badgeColor: "#a855f7",
    accentColor: "#a855f7",
    placeholder: "Snov.io API key",
  },
  {
    key: "lusha",
    name: "Lusha",
    description: "B2B contact information and enrichment",
    badge: "LU",
    badgeColor: "#eab308",
    accentColor: "#eab308",
    placeholder: "Lusha API key",
  },
  {
    key: "contactout",
    name: "ContactOut",
    description: "Find emails and phone numbers from LinkedIn",
    badge: "CO",
    badgeColor: "#14b8a6",
    accentColor: "#14b8a6",
    placeholder: "ContactOut API key",
  },
  {
    key: "openrouter",`;

content = content.replace(oldIntegrations, newIntegrations);
fs.writeFileSync('pages/settings.tsx', content);
