import type { Question } from "./types";

// 2026학년도 2학년 2학기 미적분 수학개념 도슨트 1차 질문목록
export const QUESTION_BANK: readonly Question[] = [
  {
    id: "1-L1",
    round: 1,
    difficulty: "LOW",
    title: "하 1 · 함수의 연속",
    prompt:
      "함수 $f(x)=\begin{cases} 2x+a & (x<3) \\ \sqrt{x+1}-a & (x\geq 3) \end{cases}$ 가 $x=3$에서 연속일 때, 상수 $a$의 값을 구하고 설명하시오.",
  },
  {
    id: "1-L2",
    round: 1,
    difficulty: "LOW",
    title: "하 2 · 미분계수",
    prompt:
      "함수 $y=f(x)=x^2-4x+2$에 대하여 $\displaystyle\lim_{h\to 0}\frac{f(4+h)-f(4)}{h}$의 값을 구하고 설명하시오.",
  },
  {
    id: "1-L3",
    round: 1,
    difficulty: "LOW",
    title: "하 3 · 극값",
    prompt: "$f(x)=2x^3-3x+1$일 때, $f(x)$의 극값을 모두 구하고 설명하시오.",
  },
  {
    id: "1-M1",
    round: 1,
    difficulty: "MID",
    title: "중 1 · 곱으로 나타낸 함수의 연속",
    prompt:
      "두 함수 $f(x)=\begin{cases} -2x+3 & (x<0) \\ -2x+2 & (x\geq 0) \end{cases}$, $g(x)=\begin{cases} 2x & (x<a) \\ 2x-1 & (x\geq a) \end{cases}$ 가 있다. 함수 $f(x)g(x)$가 실수 전체의 집합에서 연속이 되도록 하는 상수 $a$의 값은?",
  },
  {
    id: "1-M2",
    round: 1,
    difficulty: "MID",
    title: "중 2 · 접선의 방정식",
    prompt:
      "기울기가 $8$이고 $y$절편이 양수인 직선이 곡선 $y=x^3-3x^2-x+2$에 접할 때, 이 직선은 점 $(1,\,k)$를 지난다. $k$의 값을 구하고 설명하시오.",
  },
  {
    id: "1-M3",
    round: 1,
    difficulty: "MID",
    title: "중 3 · 극댓값과 극솟값",
    prompt:
      "함수 $f(x)=2x^3-3ax^2+5a$의 극솟값이 $a$일 때, 함수 $f(x)$의 극댓값을 구하고 설명하시오.",
  },
  {
    id: "1-H1",
    round: 1,
    difficulty: "HIGH",
    title: "상 1 · 미분계수와 접선",
    prompt:
      "최고차항의 계수가 $1$이고 $f(0)=0$인 삼차함수 $f(x)$가 $\displaystyle\lim_{x\to a}\frac{f(x)-1}{x-a}=3$을 만족시킨다. 곡선 $y=f(x)$ 위의 점 $(a,\,f(a))$에서의 접선의 $y$절편이 $4$일 때, $f(1)$의 값은?",
  },
  {
    id: "1-H2",
    round: 1,
    difficulty: "HIGH",
    title: "상 2 · 함수의 극한",
    prompt:
      "일차함수 $f(x)$에 대하여 $\displaystyle\lim_{x\to a}\frac{f(x+2)}{x(f(x)-3)}$의 값이 $a=0$일 때 존재하고 $a=3$일 때 존재하지 않는다. $f(4)$의 값은?",
  },
  {
    id: "1-H3",
    round: 1,
    difficulty: "HIGH",
    title: "상 3 · 삼차함수의 극값",
    prompt:
      "두 삼차함수 $f(x)$와 $g(x)$가 모든 실수 $x$에 대하여 $f(x)g(x)=(x-1)^2(x-2)^2(x-3)^2$을 만족시킨다. $g(x)$의 최고차항의 계수가 $3$이고, $g(x)$가 $x=2$에서 극댓값을 가질 때, $f'(0)=\dfrac{q}{p}$이다. $p+q$의 값을 구하시오. (단, $p$와 $q$는 서로소인 자연수이다.)",
  },
];

