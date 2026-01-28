/**
 * Hitlist Data - Sprint 10 Data Loading
 * Real prospect data from Manifest 2026 Hitlist
 */

import { Prospect } from '../types';

// Company tier data from Company Hitlist
const COMPANY_TIERS: Record<string, { tier: string; companyScore: number }> = {
  'GXO': { tier: 'Tier 1', companyScore: 157 },
  'StockX': { tier: 'Tier 1', companyScore: 125 },
  'Unilever': { tier: 'Tier 1', companyScore: 91 },
  'Thrive Market': { tier: 'Tier 1', companyScore: 90 },
  'Unilever Prestige': { tier: 'Tier 1', companyScore: 90 },
  'Fabletics': { tier: 'Tier 1', companyScore: 87 },
  'Patagonia': { tier: 'Tier 1', companyScore: 87 },
  'Kraft Heinz': { tier: 'Tier 1', companyScore: 85 },
  'Global Industrial Company': { tier: 'Tier 1', companyScore: 82 },
  'Ford Motor Company': { tier: 'Tier 2', companyScore: 76 },
  'GOAT Group': { tier: 'Tier 2', companyScore: 76 },
  'GEODIS': { tier: 'Tier 2', companyScore: 76 },
  'Ryder System, Inc.': { tier: 'Tier 2', companyScore: 75 },
  'ULINE': { tier: 'Tier 2', companyScore: 75 },
  'Cardinal Health': { tier: 'Tier 2', companyScore: 72 },
  'Church & Dwight': { tier: 'Tier 2', companyScore: 72 },
  'Uline': { tier: 'Tier 2', companyScore: 70 },
  'DHL Supply Chain': { tier: 'Tier 2', companyScore: 69 },
  'Kenvue': { tier: 'Tier 2', companyScore: 68 },
  'Dollar General': { tier: 'Tier 2', companyScore: 66 },
  'PepsiCo': { tier: 'Tier 2', companyScore: 62 },
  'BNSF Railway': { tier: 'Tier 2', companyScore: 62 },
  'Butcher Box': { tier: 'Tier 2', companyScore: 62 },
  'Amazon': { tier: 'Tier 2', companyScore: 61 },
  'Mattel': { tier: 'Tier 2', companyScore: 61 },
  'Target': { tier: 'Tier 2', companyScore: 60 },
  'Misfits Market': { tier: 'Tier 2', companyScore: 60 },
  'GoodShip': { tier: 'Tier 2', companyScore: 59 },
  'Covenant Logistics': { tier: 'Tier 2', companyScore: 59 },
  'DSV': { tier: 'Tier 2', companyScore: 57 },
  'Cart.com': { tier: 'Tier 2', companyScore: 57 },
  'Distribution Management': { tier: 'Tier 2', companyScore: 57 },
  'PPL Electric': { tier: 'Tier 1', companyScore: 37 }, // Top person score
  'Apothecary Products': { tier: 'Tier 2', companyScore: 42 },
  'Dell Technologies': { tier: 'Tier 2', companyScore: 34 },
  'Gentex Corporation': { tier: 'Tier 2', companyScore: 34 },
  'Johnson & Johnson': { tier: 'Tier 3', companyScore: 46 },
};

// Top prospects from the hitlist - prioritized by score and tier
export const HITLIST_PROSPECTS: Prospect[] = [
  // Tier 1 - High Priority
  { id: '1', name: 'Jamie Saucedo', title: 'Vice President, Business Operations', company: 'GXO', tier: 'Tier 1', score: 157, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: true },
  { id: '2', name: 'Alexis Takvorian', title: 'VP, Global Transportation', company: 'StockX', tier: 'Tier 1', score: 125, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '3', name: 'Andrew Sylling', title: 'Head of Procurement, Logistics North America', company: 'Unilever', tier: 'Tier 1', score: 91, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '4', name: 'Cherris Armour', title: 'VP, Fulfillment', company: 'Thrive Market', tier: 'Tier 1', score: 90, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '5', name: 'Bert Hooper', title: 'Senior VP, Global Fulfillment Center', company: 'Fabletics', tier: 'Tier 1', score: 87, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '6', name: 'Chris Joyce', title: 'North America VP, Logistics & Distribution', company: 'Patagonia', tier: 'Tier 1', score: 87, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '7', name: 'Bill Durbin', title: 'Vice President of Logistics', company: 'Kraft Heinz', tier: 'Tier 1', score: 85, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '8', name: 'Christopher Longhito', title: 'SVP & Chief Supply Chain Officer', company: 'Global Industrial Company', tier: 'Tier 1', score: 82, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: false },
  
  // Top Scoring Individuals (Person Score 37+)
  { id: '9', name: 'Sheetal Shah', title: 'VP of Supply Chain and Chief Procurement Officer', company: 'PPL Electric', tier: 'Tier 1', score: 37, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: false },
  
  // High-Value Tier 2 Targets
  { id: '10', name: 'Douglas Cantriel', title: 'Head of North American Transportation & Modernization', company: 'Ford Motor Company', tier: 'Tier 2', score: 76, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: false },
  { id: '11', name: 'Ken Boremi', title: 'VP Global Logistics', company: 'GOAT Group', tier: 'Tier 2', score: 76, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '12', name: 'John Lower', title: 'VP, Transportation Brokerage', company: 'GEODIS', tier: 'Tier 2', score: 76, isOps: true, isExec: true, status: 'new', category: 'Sponsor', qualified: true },
  { id: '13', name: 'Kendra Phillips', title: 'VP Transportation Management & Brokerage', company: 'Ryder System, Inc.', tier: 'Tier 2', score: 75, isOps: true, isExec: true, status: 'new', category: 'Sponsor', qualified: false },
  { id: '14', name: 'Angelo Ventrone', title: 'VP of Logistics', company: 'ULINE', tier: 'Tier 2', score: 75, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: true },
  { id: '15', name: 'Carlos Ruiz', title: 'EVP, Chief Supply Chain Officer', company: 'Church & Dwight', tier: 'Tier 2', score: 72, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: false },
  { id: '16', name: 'James Hoskins', title: 'Vice President Operations', company: 'DHL Supply Chain', tier: 'Tier 2', score: 69, isOps: true, isExec: true, status: 'new', category: 'Sponsor', qualified: true },
  { id: '17', name: 'Meri Stevens', title: 'Chief Operations Officer', company: 'Kenvue', tier: 'Tier 2', score: 68, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: true },
  { id: '18', name: 'Rod West', title: 'EVP, Global Supply Chain', company: 'Dollar General', tier: 'Tier 2', score: 66, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: false },
  { id: '19', name: 'Clark Howard', title: 'Chief Supply Chain and Procurement Officer', company: 'Butcher Box', tier: 'Tier 2', score: 62, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '20', name: 'Neil Neufeld', title: 'Chief Supply Chain Officer', company: 'Misfits Market', tier: 'Tier 2', score: 60, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: false },
  { id: '21', name: 'Daryl Glass', title: 'SVP, Fulfillment & Last Mile', company: 'Target', tier: 'Tier 2', score: 60, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: true },
  
  // Additional High-Score Speakers (Score 34)
  { id: '22', name: 'Jeff Adams', title: 'VP of Strategic Sourcing & Inbound Logistics', company: 'Apothecary Products', tier: 'Tier 2', score: 34, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '23', name: 'Terry Frizelle', title: 'Head of Logistics Procurement', company: 'Dell Technologies', tier: 'Tier 2', score: 34, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: true },
  { id: '24', name: 'Randy Pappal', title: 'VP Purchasing and Supply Chain', company: 'Gentex Corporation', tier: 'Tier 2', score: 34, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '25', name: 'Jamie Hess', title: 'VP, Global Transportation Procurement', company: 'KBX', tier: 'Tier 2', score: 34, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '26', name: 'Megan Hunter', title: 'EVP Procurement and Supply Chain Operations', company: 'Martinrea International', tier: 'Tier 2', score: 34, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '27', name: 'Mohamed Saleh', title: 'Head of Logistics & Real Estate Sourcing', company: 'Owens Corning', tier: 'Tier 2', score: 34, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '28', name: 'Miguel Miciano', title: 'SVP Procurement & Logistics', company: 'Pomona Farming', tier: 'Tier 2', score: 34, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  { id: '29', name: 'Lance Starks', title: 'VP - Global Supply Chain & Sourcing', company: 'Shaw Industries', tier: 'Tier 2', score: 34, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: false },
  
  // High-Value Speakers (Score 29)
  { id: '30', name: 'Sarah Clarke', title: 'Chief Supply Chain & Technology Officer', company: 'AEO Inc', tier: 'Tier 2', score: 29, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: false },
  { id: '31', name: 'Bineetha Balakrishnan', title: 'VP, Global Transportation & Trade Operations', company: 'Johnson & Johnson', tier: 'Tier 2', score: 29, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: true },
  { id: '32', name: 'Heather Burke', title: 'SVP Logistics & Customer Experience', company: 'Revolve', tier: 'Tier 2', score: 29, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: true },
  { id: '33', name: 'Wendy Spratt', title: 'Head of Global Supply Chain', company: 'Intel', tier: 'Tier 2', score: 29, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: false },
  { id: '34', name: 'Pascal Montilus', title: 'Chief Supply Chain Officer', company: 'The Clorox Company', tier: 'Tier 2', score: 29, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: false },
  { id: '35', name: 'Nish Embry', title: 'Head of SCPMCOE Innovation & Supply Chain', company: 'The Coca-Cola Company', tier: 'Tier 2', score: 29, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: false },
  { id: '36', name: 'Anders Karlborg', title: 'EVP, Manufacturing, Logistics & Operational Excellence', company: 'Vertiv', tier: 'Tier 2', score: 29, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: true },
  { id: '37', name: 'Dawn Swackhamer', title: 'VP Global Operations & Planning Technology', company: 'Pandora', tier: 'Tier 2', score: 29, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: true },
  { id: '38', name: 'Karon Evanoff', title: 'SVP Global Operations', company: 'QSC', tier: 'Tier 2', score: 29, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: true },
  { id: '39', name: 'Audreyanne Snow', title: 'VP, Operations & Logistics', company: 'Parts Town', tier: 'Tier 2', score: 29, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: true },
  { id: '40', name: 'Lisa Backlin', title: 'Group Senior Vice President, Supply Chain', company: 'Parts Town', tier: 'Tier 2', score: 29, isOps: true, isExec: true, status: 'new', category: 'Speaker', qualified: false },
  
  // Sponsors with High Qualification
  { id: '41', name: 'Doug King', title: 'VP of Transportation', company: 'Cart.com', tier: 'Tier 2', score: 28, isOps: true, isExec: true, status: 'new', category: 'Sponsor', qualified: true },
  { id: '42', name: 'Mario Rivera', title: 'SVP, Fulfillment Solutions', company: 'Cart.com', tier: 'Tier 2', score: 28, isOps: true, isExec: true, status: 'new', category: 'Sponsor', qualified: true },
  { id: '43', name: 'Mike Castle', title: 'Head of Transportation and Parcel Strategy', company: 'Flexport', tier: 'Tier 2', score: 28, isOps: true, isExec: true, status: 'new', category: 'Sponsor', qualified: true },
  { id: '44', name: 'Roger Sechler', title: 'Vice President of Transportation', company: '4flow', tier: 'Tier 2', score: 28, isOps: true, isExec: true, status: 'new', category: 'Sponsor', qualified: true },
  { id: '45', name: 'Shaun Nakhost', title: 'VP Warehouse Operations', company: 'Dependable Supply Chain Services', tier: 'Tier 2', score: 28, isOps: true, isExec: true, status: 'new', category: 'Sponsor', qualified: true },
  
  // Additional Tier 3 High-Value
  { id: '46', name: 'Joshua Dolan', title: 'SVP Demand Chain & Logistics', company: '7-Eleven', tier: 'Tier 3', score: 26, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: true },
  { id: '47', name: 'Jen Baiker', title: 'VP - Transportation And Customer Promise', company: 'AEO', tier: 'Tier 3', score: 26, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: true },
  { id: '48', name: 'Frank Mainolfi', title: 'SVP of Logistics', company: 'Ajinomoto Foods North America', tier: 'Tier 3', score: 26, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: true },
  { id: '49', name: 'Scott Casciato', title: 'VP, Global Logistics & Omnichannel Fulfillment', company: "DICK'S Sporting Goods", tier: 'Tier 3', score: 26, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: true },
  { id: '50', name: 'Ailen Fee', title: 'SVP of Operations', company: 'Dandy', tier: 'Tier 3', score: 26, isOps: true, isExec: true, status: 'new', category: 'Attendee', qualified: true },
];

/**
 * Get the company tier info
 */
export function getCompanyTier(company: string): { tier: string; companyScore: number } | null {
  return COMPANY_TIERS[company] || null;
}

/**
 * Get all prospects sorted by score
 */
export function getAllProspects(): Prospect[] {
  return [...HITLIST_PROSPECTS].sort((a, b) => b.score - a.score);
}

/**
 * Get Tier 1 prospects only
 */
export function getTier1Prospects(): Prospect[] {
  return HITLIST_PROSPECTS.filter(p => p.tier === 'Tier 1').sort((a, b) => b.score - a.score);
}

/**
 * Get qualified prospects
 */
export function getQualifiedProspects(): Prospect[] {
  return HITLIST_PROSPECTS.filter(p => p.qualified).sort((a, b) => b.score - a.score);
}
