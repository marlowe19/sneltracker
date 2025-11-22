#!/usr/bin/env node

/**
 * Backup Verification Script
 * 
 * Analyzes the Firestore backup and shows what will be migrated
 * WITHOUT actually performing the migration
 * 
 * Usage: node scripts/migration/verify-backup.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_PATH = path.join(__dirname, '../backups/firebase-backup-local-2025-11-15T08-07-04/backup.json');

console.log('📊 Analyzing Firestore Backup...\n');

try {
  const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
  
  console.log(`📅 Backup Date: ${backup.timestamp}\n`);
  
  // Projects Analysis
  const sharedProjects = backup.collections.projects || [];
  const users = backup.collections.users || [];
  const userProjects = users.reduce((acc, user) => {
    const projects = user.subcollections?.projects || [];
    return acc.concat(projects.map(p => ({ ...p, user: user.id })));
  }, []);
  
  console.log('📦 PROJECTS');
  console.log(`  Shared Projects:  ${sharedProjects.length}`);
  console.log(`  User Projects:    ${userProjects.length}`);
  console.log(`  Total Projects:   ${sharedProjects.length + userProjects.length}`);
  
  if (sharedProjects.length > 0) {
    console.log('\n  Shared Projects List:');
    sharedProjects.forEach(p => {
      const memberCount = p.subcollections?.members?.length || 0;
      const entryCount = p.subcollections?.['time-entries']?.length || 0;
      console.log(`    • ${p.data.name} (${p.data.owner})`);
      console.log(`      - ${memberCount} members, ${entryCount} time entries`);
    });
  }
  
  if (userProjects.length > 0) {
    console.log('\n  User Projects List:');
    userProjects.slice(0, 10).forEach(p => {
      console.log(`    • ${p.data.name} (${p.user})`);
    });
    if (userProjects.length > 10) {
      console.log(`    ... and ${userProjects.length - 10} more`);
    }
  }
  
  // Members Analysis
  const allMembers = sharedProjects.reduce((acc, p) => {
    return acc + (p.subcollections?.members?.length || 0);
  }, 0);
  
  console.log(`\n👥 PROJECT MEMBERS`);
  console.log(`  Total Members:    ${allMembers}`);
  
  const membersByProject = sharedProjects
    .map(p => ({
      name: p.data.name,
      count: p.subcollections?.members?.length || 0,
      members: p.subcollections?.members || []
    }))
    .filter(p => p.count > 0)
    .sort((a, b) => b.count - a.count);
  
  if (membersByProject.length > 0) {
    console.log('\n  Members by Project:');
    membersByProject.forEach(p => {
      console.log(`    • ${p.name}: ${p.count} members`);
      p.members.forEach(m => {
        const rate = m.data.hourly_rate ? `€${m.data.hourly_rate}/hr` : 'no rate';
        console.log(`      - ${m.data.user_name} (${m.data.role}, ${rate})`);
      });
    });
  }
  
  // Time Entries Analysis
  const sharedEntries = sharedProjects.reduce((acc, p) => {
    return acc + (p.subcollections?.['time-entries']?.length || 0);
  }, 0);
  
  const userEntries = users.reduce((acc, u) => {
    return acc + (u.subcollections?.['time-entries']?.length || 0);
  }, 0);
  
  const standaloneEntries = backup.collections.time_entries?.length || 0;
  
  console.log(`\n⏰ TIME ENTRIES`);
  console.log(`  Shared Project Entries:  ${sharedEntries}`);
  console.log(`  User Entries:            ${userEntries}`);
  console.log(`  Standalone Entries:      ${standaloneEntries}`);
  console.log(`  Total Entries:           ${sharedEntries + userEntries + standaloneEntries}`);
  
  // Check for entries without projects
  const entriesWithoutProject = [];
  users.forEach(u => {
    const entries = u.subcollections?.['time-entries'] || [];
    entries.forEach(e => {
      if (!e.data.project) {
        entriesWithoutProject.push({ user: u.id, entry: e.id });
      }
    });
  });
  
  (backup.collections.time_entries || []).forEach(e => {
    if (!e.data.project) {
      entriesWithoutProject.push({ entry: e.id });
    }
  });
  
  if (entriesWithoutProject.length > 0) {
    console.log(`  ⚠️  Entries without project: ${entriesWithoutProject.length}`);
  }
  
  // Running timers
  let runningTimers = 0;
  users.forEach(u => {
    const entries = u.subcollections?.['time-entries'] || [];
    runningTimers += entries.filter(e => e.data.is_running).length;
  });
  
  if (runningTimers > 0) {
    console.log(`  ⏱️  Running timers: ${runningTimers}`);
  }
  
  // Expenses Analysis
  const expenses = backup.collections.expenses || [];
  
  console.log(`\n💰 EXPENSES`);
  console.log(`  Total Expenses:   ${expenses.length}`);
  
  if (expenses.length > 0) {
    const totalAmount = expenses.reduce((sum, e) => sum + (e.data.price || 0), 0);
    console.log(`  Total Amount:     €${totalAmount.toFixed(2)}`);
    
    const byType = expenses.reduce((acc, e) => {
      const type = e.data.expense_type || 'unspecified';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n  Expenses by Type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`    • ${type}: ${count}`);
    });
    
    const byProject = {};
    expenses.forEach(e => {
      const projectId = e.data.project || 'no-project';
      if (!byProject[projectId]) {
        byProject[projectId] = { count: 0, total: 0, items: [] };
      }
      byProject[projectId].count++;
      byProject[projectId].total += e.data.price || 0;
      byProject[projectId].items.push(e.data.name);
    });
    
    console.log('\n  Expenses by Project:');
    Object.entries(byProject).forEach(([projectId, data]) => {
      const projectName = sharedProjects.find(p => p.id === projectId)?.data.name || 
                         userProjects.find(p => p.id === projectId)?.data.name ||
                         'Unknown Project';
      console.log(`    • ${projectName}: ${data.count} items, €${data.total.toFixed(2)}`);
    });
  }
  
  // Users Analysis
  console.log(`\n👤 USERS`);
  console.log(`  Total Users:      ${users.length}`);
  console.log(`  Users with data:  ${users.filter(u => 
    (u.subcollections?.projects?.length || 0) > 0 || 
    (u.subcollections?.['time-entries']?.length || 0) > 0
  ).length}`);
  
  if (users.length > 0) {
    console.log('\n  User Activity:');
    users.forEach(u => {
      const projects = u.subcollections?.projects?.length || 0;
      const entries = u.subcollections?.['time-entries']?.length || 0;
      if (projects > 0 || entries > 0) {
        console.log(`    • ${u.id}: ${projects} projects, ${entries} time entries`);
      }
    });
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ MIGRATION SUMMARY');
  console.log(`
  Will migrate:
    • ${sharedProjects.length + userProjects.length} projects
    • ${allMembers} project members
    • ${sharedEntries + userEntries + standaloneEntries} time entries
    • ${expenses.length} expenses
  `);
  
  if (entriesWithoutProject.length > 0) {
    console.log(`  ⚠️  Warnings:`);
    console.log(`    • ${entriesWithoutProject.length} time entries have no project link`);
  }
  
  console.log('\n🚀 Ready to migrate! Run: npm run migrate\n');
  
} catch (error) {
  console.error('❌ Error reading backup:', error.message);
  console.error('\nMake sure the backup file exists at:');
  console.error(BACKUP_PATH);
  process.exit(1);
}

