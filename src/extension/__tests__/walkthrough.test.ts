import * as fs from 'fs';
import * as path from 'path';

describe('walkthrough configuration', () => {
  const packageJsonPath = path.resolve(__dirname, '../../../package.json');
  let pkg: any;

  beforeAll(() => {
    pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  });

  const getWalkthrough = () => {
    const walkthroughs = pkg.contributes?.walkthroughs;
    expect(walkthroughs).toBeDefined();
    return walkthroughs[0];
  };

  it('should have a walkthrough with id hledger.getStarted', () => {
    const walkthrough = getWalkthrough();
    expect(walkthrough.id).toBe('hledger.getStarted');
  });

  it('should have 5 steps in order', () => {
    const walkthrough = getWalkthrough();
    const stepIds = walkthrough.steps.map((s: any) => s.id);

    expect(stepIds).toEqual([
      'hledger.installLSP',
      'hledger.openJournal',
      'hledger.importCSV',
      'hledger.reports',
      'hledger.keybindings',
    ]);
  });

  describe('reports step', () => {
    const getReportsStep = () => {
      const walkthrough = getWalkthrough();
      return walkthrough.steps.find((s: any) => s.id === 'hledger.reports');
    };

    it('should exist', () => {
      expect(getReportsStep()).toBeDefined();
    });

    it('should reference reports.md media', () => {
      const step = getReportsStep();
      expect(step.media.markdown).toBe('docs/walkthrough/reports.md');
    });

    it('should have completion events for all CLI commands', () => {
      const step = getReportsStep();
      expect(step.completionEvents).toContain('onCommand:hledger.cli.balance');
      expect(step.completionEvents).toContain('onCommand:hledger.cli.incomestatement');
      expect(step.completionEvents).toContain('onCommand:hledger.cli.stats');
    });

    it('should have a media file that exists', () => {
      const step = getReportsStep();
      const mediaPath = path.resolve(__dirname, '../../../', step.media.markdown);
      expect(fs.existsSync(mediaPath)).toBe(true);
    });
  });

  describe('keybindings step', () => {
    const getKeybindingsStep = () => {
      const walkthrough = getWalkthrough();
      return walkthrough.steps.find((s: any) => s.id === 'hledger.keybindings');
    };

    it('should exist', () => {
      expect(getKeybindingsStep()).toBeDefined();
    });

    it('should reference keybindings.md media', () => {
      const step = getKeybindingsStep();
      expect(step.media.markdown).toBe('docs/walkthrough/keybindings.md');
    });

    it('should have completion events for status and align commands', () => {
      const step = getKeybindingsStep();
      expect(step.completionEvents).toContain('onCommand:hledger.editor.cycleStatus');
      expect(step.completionEvents).toContain('onCommand:hledger.editor.alignAmount');
    });

    it('should have a media file that exists', () => {
      const step = getKeybindingsStep();
      const mediaPath = path.resolve(__dirname, '../../../', step.media.markdown);
      expect(fs.existsSync(mediaPath)).toBe(true);
    });
  });

  describe('all steps', () => {
    it('should have media files that exist for every step', () => {
      const walkthrough = getWalkthrough();
      for (const step of walkthrough.steps) {
        const mediaPath = path.resolve(__dirname, '../../../', step.media.markdown);
        expect(fs.existsSync(mediaPath)).toBe(true);
      }
    });

    it('should have non-empty completionEvents for every step', () => {
      const walkthrough = getWalkthrough();
      for (const step of walkthrough.steps) {
        expect(step.completionEvents.length).toBeGreaterThan(0);
      }
    });
  });
});
