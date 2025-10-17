#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

interface BattleMessage {
  to: string;
  from: string;
  type: string;
  date: string;
  content: string;
  isAttacking: boolean; // true if "from" is enderland (enderland is attacking)
}

interface GroundBattleResult {
  soldiersLost: number;
  soldiersKilled: number;
  tanksLost: number;
  tanksKilled: number;
  landRazed: number;
  landDestroyed: number;
  technologyStolen: number;
  technologyDestroyed: number;
  infrastructureDestroyed: number;
  moneyLooted: number;
  moneyDestroyed: number;
  equipmentGained: number;
  result: 'Victory' | 'Defeat';
}

interface AirAttackResult {
  defendingTanksLost: number;
  cruiseMissilesLost: number;
  infrastructureLost: number;
  attackingBombersDestroyed: number;
  fighterAircraftLost: number;
  enemyFighterAircraftDestroyed: number;
  isEscorted: boolean;
  isBombingRun: boolean;
}

interface BattleSummary {
  opponent: string;
  attacking: {
    groundBattles: {
      wins: number;
      defeats: number;
      underdogBonuses: number;
    };
    airAttacks: {
      wins: number;
      losses: number;
    };
  };
  defending: {
    groundBattles: {
      wins: number;
      defeats: number;
      underdogBonuses: number;
    };
    airAttacks: {
      wins: number;
      losses: number;
    };
  };
  totalWins: number;
  totalLosses: number;
}

class BattleParser {
  private messages: BattleMessage[] = [];
  private summaries: Map<string, BattleSummary> = new Map();
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  parseFile(): void {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n');
    
    let currentMessage: BattleMessage | null = null;
    let messageContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      
      // Start of new message - look for TO: line
      if (trimmedLine.startsWith('TO:')) {
        // Save previous message if exists
        if (currentMessage) {
          currentMessage.content = messageContent.join('\n');
          this.messages.push(currentMessage);
        }

        // Parse new message header
        const toMatch = trimmedLine.match(/TO:\s*([^|]+)/);
        const fromMatch = trimmedLine.match(/FROM:\s*([^|]+)/);
        
        if (toMatch && fromMatch) {
          // Look for TYPE and DATE on the next line
          let type = '';
          let date = '';
          
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.startsWith('TYPE:')) {
              const typeMatch = nextLine.match(/TYPE:\s*(.+?)(?:\s*\|\s*DATE:|\s*DATE:)/);
              const dateMatch = nextLine.match(/DATE:\s*(.+)/);
              if (typeMatch) type = typeMatch[1].trim();
              if (dateMatch) date = dateMatch[1].trim();
            }
          }

          if (type && date) {
            currentMessage = {
              to: toMatch[1].trim(),
              from: fromMatch[1].trim(),
              type: type,
              date: date,
              content: '',
              isAttacking: fromMatch[1].trim() === 'enderland'
            };
            messageContent = [trimmedLine, lines[i + 1]];
          }
        }
      } else if (currentMessage && trimmedLine) {
        messageContent.push(trimmedLine);
      }
    }

    // Don't forget the last message
    if (currentMessage) {
      currentMessage.content = messageContent.join('\n');
      this.messages.push(currentMessage);
    }

    console.log(`Parsed ${this.messages.length} battle messages`);
  }

  categorizeBattles(): void {
    for (const message of this.messages) {
      // Process both attacking and defending messages
      const opponent = message.isAttacking ? message.to : message.from;
      
      if (!this.summaries.has(opponent)) {
        this.summaries.set(opponent, {
          opponent,
          attacking: {
            groundBattles: { wins: 0, defeats: 0, underdogBonuses: 0 },
            airAttacks: { wins: 0, losses: 0 }
          },
          defending: {
            groundBattles: { wins: 0, defeats: 0, underdogBonuses: 0 },
            airAttacks: { wins: 0, losses: 0 }
          },
          totalWins: 0,
          totalLosses: 0
        });
      }

      const summary = this.summaries.get(opponent)!;

      const include_ground_battle_logs = false;

      const include_air_attack_logs = true;
      const log_ground_battle = (text: string) => {
        if (include_ground_battle_logs) {
            console.log(text);

        }

      }
      if (this.isGroundBattle(message.type)) {
        const result = this.parseGroundBattle(message.content);
        log_ground_battle(`ground battle result: message.from: ${message.from}, message.to: ${message.to}, result: ${JSON.stringify(result)}}`);
        if (result) {
          
          if (message.from === 'enderland') {
            if (result.result === 'Defeat') {
              summary.attacking.groundBattles.wins++;
              log_ground_battle(`logged as my victory`)
            } else if (result.result === 'Victory') {
              // Check if it's an underdog bonus (defeat with damage)              
              if (this.hasGroundDamage(result)) {
                summary.attacking.groundBattles.underdogBonuses++;
                log_ground_battle(`logged as my underdog bonus win`)
              } else {
                summary.attacking.groundBattles.defeats++;
                log_ground_battle(`logged as my defeat`)
              }
            }
          } else {
            if (result.result === 'Victory') {
                if (this.hasGroundDamage(result)) {
                    summary.defending.groundBattles.underdogBonuses++;
                    log_ground_battle(`logged as losing defensiveunderdog bonus due to damage`)
                } else {
              summary.defending.groundBattles.wins++;
              log_ground_battle(`logged as defending win`)
                }
            } else if (result.result === 'Defeat') {
              // Check if it's an underdog bonus (defeat with damage)              
                summary.defending.groundBattles.defeats++;
                log_ground_battle(`logged as losing`)
              }
            }
          }
          log_ground_battle('--------------------------------')

      } else if (this.isAirAttack(message.type)) {

        const log_air_attack = (text: string) => {
          if (include_air_attack_logs) {
            console.log(text);
          }
        }
        const result = this.parseAirAttack(message.content);

        log_air_attack(`air attack result: message.from: ${message.from}, message.to: ${message.to}, result: ${JSON.stringify(result)}}`);
        if (result) {
          const airType = message.isAttacking ? summary.attacking.airAttacks : summary.defending.airAttacks;
          
          // Win if: 1) does damage OR 2) is unescorted with 0 damage
          const hasDamage = this.hasAirDamage(result);
          const isWin = hasDamage || (!result.isEscorted && !hasDamage);
          if (message.from === 'enderland') {
            if (isWin) {
                summary.attacking.airAttacks.wins++;
              log_air_attack(`logged as my victory`)
            } else {
                summary.attacking.airAttacks.defeats++;              
                log_air_attack(`logged as my defeat`)
            }
          } else {
            if (isWin) {
                summary.defending.airAttacks.defeats++;
              log_air_attack(`logged as my defending defeat`)
            } else {
                summary.defending.airAttacks.wins++;              
                log_air_attack(`logged as my defending victory`)
            }
          }
          log_air_attack('--------------------------------')
        }
      }
    }
  }

  private isGroundBattle(type: string): boolean {
    return type.includes('Ground Battle');
  }

  private isAirAttack(type: string): boolean {
    return type.includes('Bombing Attack') || type.includes('Aircraft Dog Fight');
  }

  private hasGroundDamage(result: GroundBattleResult): boolean {
    // For ground battles, damage is when you inflict damage on the enemy
    // This means you stole/destroyed their resources or gained money
    return result.landRazed > 0 || result.landDestroyed > 0 || 
           result.technologyStolen > 0 || result.technologyDestroyed > 0 ||
           result.infrastructureDestroyed > 0;
  }

  private hasAirDamage(result: AirAttackResult): boolean {
    // For air attacks, damage is when you destroy enemy units or infrastructure
    return result.defendingTanksLost > 0 || result.cruiseMissilesLost > 0 || 
           result.infrastructureLost > 0;
  }

  private parseGroundBattle(content: string): GroundBattleResult | null {
    try {
      const lines = content.split('\n');
      
      // Extract battle results
      const resultLine = lines.find(line => line.includes('battle was a'));
      if (!resultLine) return null;

      const result = resultLine.includes('Victory') ? 'Victory' : 'Defeat';

      // Parse the detailed battle stats
      const statsLine = lines.find(line => line.includes('You lost') && line.includes('soldiers'));
      if (!statsLine) return null;

      // Extract numbers using regex
      const soldiersLostMatch = statsLine.match(/You lost ([\d,]+) soldiers/);
      const soldiersKilledMatch = statsLine.match(/You killed ([\d,]+) soldiers/);
      const tanksLostMatch = statsLine.match(/You lost [\d,]+ soldiers and ([\d,]+) tanks/);
      const tanksKilledMatch = statsLine.match(/You killed [\d,]+ soldiers and ([\d,]+) tanks/);

      // Extract damage stats - look for both "your land" and "enemy's" patterns
      const landRazedMatch = content.match(/razed ([\d.]+) miles of (?:your|your enemy's) land/);
      const landDestroyedMatch = content.match(/destroyed ([\d.]+) miles of (?:your|your enemy's) land/);
      const techStolenMatch = content.match(/stole ([\d.]+) technology/);
      const techDestroyedMatch = content.match(/destroyed ([\d.]+) technology/);
      const infraDestroyedMatch = content.match(/destroyed ([\d.]+) infrastructure/);
      const moneyLootedMatch = content.match(/looted \$([\d,]+\.?\d*)/);
      const moneyDestroyedMatch = content.match(/destroyed \$([\d,]+\.?\d*)/);
      const equipmentGainedMatch = content.match(/gained \$([\d,]+\.?\d*)/);
       
      return {
        soldiersLost: this.parseNumber(soldiersLostMatch?.[1]),
        soldiersKilled: this.parseNumber(soldiersKilledMatch?.[1]),
        tanksLost: this.parseNumber(tanksLostMatch?.[1]),
        tanksKilled: this.parseNumber(tanksKilledMatch?.[1]),
        landRazed: this.parseFloat(landRazedMatch?.[1]),
        landDestroyed: this.parseFloat(landDestroyedMatch?.[1]),
        technologyStolen: this.parseFloat(techStolenMatch?.[1]),
        technologyDestroyed: this.parseFloat(techDestroyedMatch?.[1]),
        infrastructureDestroyed: this.parseFloat(infraDestroyedMatch?.[1]),
        moneyLooted: this.parseFloat(moneyLootedMatch?.[1]),
        moneyDestroyed: this.parseFloat(moneyDestroyedMatch?.[1]),
        equipmentGained: this.parseFloat(equipmentGainedMatch?.[1]),
        result
      };
    } catch (error) {
      console.warn('Error parsing ground battle:', error);
      return null;
    }
  }

  private parseAirAttack(content: string): AirAttackResult | null {
    try {
      const isEscorted = content.includes('escorted');
      const isBombingRun = content.includes('bombing run') || content.includes('bombing attack');
      
      // Extract air attack stats
      const defendingTanksMatch = content.match(/you lost ([\d,]+) defending tanks/);
      const cruiseMissilesMatch = content.match(/you lost [\d,]+ defending tanks, ([\d,]+) cruise missiles/);
      const infrastructureMatch = content.match(/and ([\d.]+) infrastructure/);
      const bombersDestroyedMatch = content.match(/You destroyed ([\d,]+) attacking bombers/);
      const fightersLostMatch = content.match(/You lost ([\d,]+) fighter aircraft/);
      const enemyFightersDestroyedMatch = content.match(/destroyed ([\d,]+) fighter aircraft launched by/);
       

      return {
        defendingTanksLost: this.parseNumber(defendingTanksMatch?.[1]),
        cruiseMissilesLost: this.parseNumber(cruiseMissilesMatch?.[1]),
        infrastructureLost: this.parseFloat(infrastructureMatch?.[1]),
        attackingBombersDestroyed: this.parseNumber(bombersDestroyedMatch?.[1]),
        fighterAircraftLost: this.parseNumber(fightersLostMatch?.[1]),
        enemyFighterAircraftDestroyed: this.parseNumber(enemyFightersDestroyedMatch?.[1]),
        isEscorted,
        isBombingRun
      };
    } catch (error) {
      console.warn('Error parsing air attack:', error);
      return null;
    }
  }

  private parseNumber(str: string | undefined): number {
    if (!str) return 0;
    return parseInt(str.replace(/,/g, '')) || 0;
  }

  private parseFloat(str: string | undefined): number {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
  }

  printSummary(): void {
    console.log('\n=== BATTLE SUMMARY FOR ENDERLAND ===\n');
    
    const sortedOpponents = Array.from(this.summaries.values())
      .sort((a, b) => (b.totalWins + b.totalLosses) - (a.totalWins + a.totalLosses));

    let totalWins = 0;
    let totalLosses = 0;

    for (const summary of sortedOpponents) {
      console.log(`OPPONENT: ${summary.opponent}`);
      
      // Attacking results
      console.log(`  ATTACKING (enderland attacking ${summary.opponent}):`);
      console.log(`    Ground Battles: ${summary.attacking.groundBattles.wins}W / ${summary.attacking.groundBattles.defeats}L / ${summary.attacking.groundBattles.underdogBonuses}UB`);
      console.log(`    Air Attacks: ${summary.attacking.airAttacks.wins}W / ${summary.attacking.airAttacks.losses}L`);
      
      // Defending results
      console.log(`  DEFENDING (${summary.opponent} attacking enderland):`);
      console.log(`    Ground Battles: ${summary.defending.groundBattles.wins}W / ${summary.defending.groundBattles.defeats}L / ${summary.defending.groundBattles.underdogBonuses}UB`);
      console.log(`    Air Attacks: ${summary.defending.airAttacks.wins}W / ${summary.defending.airAttacks.losses}L`);
      
      console.log(`  TOTALS:`);
      console.log(`    Total Wins: ${summary.totalWins}`);
      console.log(`    Total Losses: ${summary.totalLosses}`);
      console.log(`    Win Rate: ${summary.totalWins + summary.totalLosses > 0 ? 
        ((summary.totalWins / (summary.totalWins + summary.totalLosses)) * 100).toFixed(1) : 0}%`);
      console.log('');

      totalWins += summary.totalWins;
      totalLosses += summary.totalLosses;
    }

    console.log('=== OVERALL TOTALS ===');
    console.log(`Total Wins: ${totalWins}`);
    console.log(`Total Losses: ${totalLosses}`);
    console.log(`Overall Win Rate: ${totalWins + totalLosses > 0 ? 
      ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1) : 0}%`);
  }
}

// Main execution
function main() {
  const filePath = path.join(process.cwd(), 'src/data/raw_battle_result.txt');
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const parser = new BattleParser(filePath);
  parser.parseFile();
  parser.categorizeBattles();
  parser.printSummary();
}

// Run the script
main();
