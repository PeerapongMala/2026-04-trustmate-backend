import {
  calculateStressScore,
  calculateDepressionScore,
  getStressLevel,
  getDepressionLevel,
  STRESS_REVERSE_ITEMS,
} from './assessment.scoring';

describe('Assessment Scoring', () => {
  // ==================== PSS-10 Stress ====================
  describe('calculateStressScore', () => {
    it('should return 0 when all answers are 0 (no stress)', () => {
      const answers = Array.from({ length: 10 }, (_, i) => ({
        questionId: `stress-${i + 1}`,
        score: 0,
      }));
      // Normal items: 0 * 6 = 0
      // Reverse items (4,5,7,8): (4-0) * 4 = 16
      expect(calculateStressScore(answers)).toBe(16);
    });

    it('should return max 40 when all normal items=4 and reverse items=0', () => {
      const answers = Array.from({ length: 10 }, (_, i) => {
        const id = `stress-${i + 1}`;
        const isReverse = STRESS_REVERSE_ITEMS.includes(id);
        return { questionId: id, score: isReverse ? 0 : 4 };
      });
      // Normal: 4 * 6 = 24
      // Reverse: (4-0) * 4 = 16
      expect(calculateStressScore(answers)).toBe(40);
    });

    it('should correctly reverse score items 4, 5, 7, 8', () => {
      // Only reverse items, score=4 → reversed to 0
      const answers = [
        { questionId: 'stress-4', score: 4 },
        { questionId: 'stress-5', score: 4 },
        { questionId: 'stress-7', score: 4 },
        { questionId: 'stress-8', score: 4 },
      ];
      expect(calculateStressScore(answers)).toBe(0);
    });

    it('should correctly reverse score items with score=1 → 3', () => {
      const answers = [{ questionId: 'stress-4', score: 1 }];
      expect(calculateStressScore(answers)).toBe(3);
    });

    it('should not reverse normal items', () => {
      const answers = [
        { questionId: 'stress-1', score: 3 },
        { questionId: 'stress-2', score: 2 },
        { questionId: 'stress-3', score: 1 },
      ];
      expect(calculateStressScore(answers)).toBe(6);
    });

    it('should calculate mixed normal and reverse items correctly', () => {
      const answers = [
        { questionId: 'stress-1', score: 3 }, // normal: 3
        { questionId: 'stress-4', score: 1 }, // reverse: 4-1=3
        { questionId: 'stress-6', score: 2 }, // normal: 2
        { questionId: 'stress-7', score: 3 }, // reverse: 4-3=1
      ];
      expect(calculateStressScore(answers)).toBe(9);
    });
  });

  describe('getStressLevel', () => {
    it('should return ต่ำ for score 0', () => {
      expect(getStressLevel(0).level).toBe('ต่ำ');
    });

    it('should return ต่ำ for score 13', () => {
      expect(getStressLevel(13).level).toBe('ต่ำ');
    });

    it('should return ปานกลาง for score 14', () => {
      expect(getStressLevel(14).level).toBe('ปานกลาง');
    });

    it('should return ปานกลาง for score 26', () => {
      expect(getStressLevel(26).level).toBe('ปานกลาง');
    });

    it('should return สูง for score 27', () => {
      expect(getStressLevel(27).level).toBe('สูง');
    });

    it('should return สูง for score 40 (max)', () => {
      expect(getStressLevel(40).level).toBe('สูง');
    });
  });

  // ==================== PHQ-9 Depression ====================
  describe('calculateDepressionScore', () => {
    it('should return 0 when all answers are 0', () => {
      const answers = Array.from({ length: 9 }, (_, i) => ({
        questionId: `phq9-${i + 1}`,
        score: 0,
      }));
      expect(calculateDepressionScore(answers)).toBe(0);
    });

    it('should return 27 when all answers are 3 (max)', () => {
      const answers = Array.from({ length: 9 }, (_, i) => ({
        questionId: `phq9-${i + 1}`,
        score: 3,
      }));
      expect(calculateDepressionScore(answers)).toBe(27);
    });

    it('should sum scores directly without reverse scoring', () => {
      const answers = [
        { questionId: 'phq9-1', score: 1 },
        { questionId: 'phq9-2', score: 2 },
        { questionId: 'phq9-3', score: 3 },
      ];
      expect(calculateDepressionScore(answers)).toBe(6);
    });
  });

  describe('getDepressionLevel', () => {
    it('should return ไม่มีหรือน้อยมาก for score 0', () => {
      expect(getDepressionLevel(0).level).toBe('ไม่มีหรือน้อยมาก');
    });

    it('should return ไม่มีหรือน้อยมาก for score 4', () => {
      expect(getDepressionLevel(4).level).toBe('ไม่มีหรือน้อยมาก');
    });

    it('should return เล็กน้อย for score 5', () => {
      expect(getDepressionLevel(5).level).toBe('เล็กน้อย');
    });

    it('should return เล็กน้อย for score 9', () => {
      expect(getDepressionLevel(9).level).toBe('เล็กน้อย');
    });

    it('should return ปานกลาง for score 10', () => {
      expect(getDepressionLevel(10).level).toBe('ปานกลาง');
    });

    it('should return ปานกลาง for score 14', () => {
      expect(getDepressionLevel(14).level).toBe('ปานกลาง');
    });

    it('should return รุนแรงปานกลาง for score 15', () => {
      expect(getDepressionLevel(15).level).toBe('รุนแรงปานกลาง');
    });

    it('should return รุนแรงปานกลาง for score 19', () => {
      expect(getDepressionLevel(19).level).toBe('รุนแรงปานกลาง');
    });

    it('should return รุนแรงสูง for score 20', () => {
      expect(getDepressionLevel(20).level).toBe('รุนแรงสูง');
    });

    it('should return รุนแรงสูง for score 27 (max)', () => {
      expect(getDepressionLevel(27).level).toBe('รุนแรงสูง');
    });
  });

  // ==================== Boundary & Edge Cases ====================
  describe('boundary cases', () => {
    it('stress: all items score 2 (midpoint) should equal 20', () => {
      const answers = Array.from({ length: 10 }, (_, i) => ({
        questionId: `stress-${i + 1}`,
        score: 2,
      }));
      // Normal (6 items): 2 * 6 = 12
      // Reverse (4 items): (4-2) * 4 = 8
      expect(calculateStressScore(answers)).toBe(20);
    });

    it('depression: empty answers should return 0', () => {
      expect(calculateDepressionScore([])).toBe(0);
    });

    it('stress: empty answers should return 0', () => {
      expect(calculateStressScore([])).toBe(0);
    });

    it('stress level recommendations should not be empty', () => {
      for (let i = 0; i <= 40; i++) {
        const result = getStressLevel(i);
        expect(result.recommendation).toBeTruthy();
        expect(result.level).toBeTruthy();
      }
    });

    it('depression level recommendations should not be empty', () => {
      for (let i = 0; i <= 27; i++) {
        const result = getDepressionLevel(i);
        expect(result.recommendation).toBeTruthy();
        expect(result.level).toBeTruthy();
      }
    });
  });
});
