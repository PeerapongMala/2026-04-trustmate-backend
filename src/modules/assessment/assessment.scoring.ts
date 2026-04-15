// PSS-10: ข้อ 4,5,7,8 คิดคะแนนกลับ (0-4 ต่อข้อ, max 40)
export const STRESS_REVERSE_ITEMS = [
  'stress-4',
  'stress-5',
  'stress-7',
  'stress-8',
];

export interface AnswerItem {
  questionId: string;
  score: number;
}

export interface ScoringResult {
  level: string;
  recommendation: string;
}

export function calculateStressScore(answers: AnswerItem[]): number {
  return answers.reduce((sum, a) => {
    const isReverse = STRESS_REVERSE_ITEMS.includes(a.questionId);
    const score = isReverse ? 4 - a.score : a.score;
    return sum + score;
  }, 0);
}

export function calculateDepressionScore(answers: AnswerItem[]): number {
  return answers.reduce((sum, a) => sum + a.score, 0);
}

export function getStressLevel(score: number): ScoringResult {
  if (score <= 13) {
    return {
      level: 'ต่ำ',
      recommendation: 'คุณมีความเครียดในระดับต่ำ ดูแลสุขภาพจิตต่อไปนะ',
    };
  } else if (score <= 26) {
    return {
      level: 'ปานกลาง',
      recommendation:
        'คุณมีความเครียดปานกลาง ลองหาเวลาพักผ่อนและทำกิจกรรมที่ชอบ',
    };
  } else {
    return {
      level: 'สูง',
      recommendation:
        'คุณมีความเครียดสูง ควรพูดคุยกับคนใกล้ชิดหรือผู้เชี่ยวชาญ',
    };
  }
}

export function getDepressionLevel(score: number): ScoringResult {
  if (score <= 4) {
    return {
      level: 'ไม่มีหรือน้อยมาก',
      recommendation: 'ไม่มีภาวะซึมเศร้าหรือมีน้อยมาก',
    };
  } else if (score <= 9) {
    return {
      level: 'เล็กน้อย',
      recommendation:
        'มีภาวะซึมเศร้าระดับเล็กน้อย ควรเริ่มสังเกตตนเองอย่างใกล้ชิด',
    };
  } else if (score <= 14) {
    return {
      level: 'ปานกลาง',
      recommendation:
        'มีภาวะซึมเศร้าระดับปานกลาง อาจจำเป็นต้องขอคำปรึกษาจากนักจิตวิทยาหรือนักจิตบำบัด',
    };
  } else if (score <= 19) {
    return {
      level: 'รุนแรงปานกลาง',
      recommendation:
        'มีภาวะซึมเศร้าระดับรุนแรงปานกลาง ควรได้รับการดูแลจากนักจิตวิทยาหรือนักจิตบำบัด',
    };
  } else {
    return {
      level: 'รุนแรงสูง',
      recommendation:
        'มีภาวะซึมเศร้าระดับรุนแรงสูง จำเป็นต้องได้รับการตรวจซึมเศร้าและรักษาอย่างเร่งด่วน',
    };
  }
}
