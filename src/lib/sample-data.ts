import { Wordbook, Word } from '@/types/database';

export const SAMPLE_WORDBOOKS: Wordbook[] = [
  {
    id: 'wb-wm-day15',
    tutor_id: '',
    tutor_name: 'SensorSsam (대표 튜터)',
    title: 'WordMaster 고등 COMPLETE',
    chapter: 'DAY 15',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    words_count: 10
  },
  {
    id: 'wb-wm-day16',
    tutor_id: '',
    tutor_name: 'SensorSsam (대표 튜터)',
    title: 'WordMaster 고등 COMPLETE',
    chapter: 'DAY 16',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    words_count: 8
  },
  {
    id: 'wb-csat-idiom',
    tutor_id: '',
    tutor_name: '강남 영어 전문 학원',
    title: '수능 빈출 필수 숙어 50',
    chapter: 'DAY 01',
    created_at: new Date().toISOString(),
    words_count: 6
  }
];

export const SAMPLE_WORDS: Record<string, Word[]> = {
  'wb-wm-day15': [
    {
      id: 'w-15-1',
      wordbook_id: 'wb-wm-day15',
      word: 'persevere',
      pronunciation: 'pə̀ːrsəvíər',
      pos: '동사',
      meaning: '인내하다; 끈기 있게 계속하다',
      example_sentence: 'She persevered in her studies despite many obstacles.',
      example_translation: '그녀는 많은 장애물에도 불구하고 학업을 인내하며 계속했다.',
      is_idiom: false,
      is_spelling_priority: true
    },
    {
      id: 'w-15-2',
      wordbook_id: 'wb-wm-day15',
      word: 'vulnerable',
      pronunciation: 'vʌ́lnərəbl',
      pos: '형용사',
      meaning: '취약한; 상처받기 쉬운',
      example_sentence: 'Elderly people are particularly vulnerable to the flu.',
      example_translation: '노인들은 특히 독감에 취약하다.',
      is_idiom: false,
      is_spelling_priority: true
    },
    {
      id: 'w-15-3',
      wordbook_id: 'wb-wm-day15',
      word: 'ambiguous',
      pronunciation: 'æmbíɡjuəs',
      pos: '형용사',
      meaning: '애매한; 모호한; 두 가지 이상의 뜻으로 해석되는',
      example_sentence: 'The instructions were ambiguous and caused confusion.',
      example_translation: '그 지시사항은 모호해서 혼란을 일으켰다.',
      is_idiom: false,
      is_spelling_priority: true
    },
    {
      id: 'w-15-4',
      wordbook_id: 'wb-wm-day15',
      word: 'scrutinize',
      pronunciation: 'skrúːtənàiz',
      pos: '동사',
      meaning: '면밀히 조사하다; 정밀하게 검토하다',
      example_sentence: 'The custom official scrutinized every passport thoroughly.',
      example_translation: '세관 직원은 모든 여권을 철저히 면밀히 검토했다.',
      is_idiom: false,
      is_spelling_priority: false
    },
    {
      id: 'w-15-5',
      wordbook_id: 'wb-wm-day15',
      word: 'meticulous',
      pronunciation: 'mətíkjuləs',
      pos: '형용사',
      meaning: '꼼꼼한; 세심한; 신중한',
      example_sentence: 'He gave meticulous attention to every detail of the plan.',
      example_translation: '그는 계획의 모든 세부 사항에 꼼꼼한 주의를 기울였다.',
      is_idiom: false,
      is_spelling_priority: true
    },
    {
      id: 'w-15-6',
      wordbook_id: 'wb-wm-day15',
      word: 'alleviate',
      pronunciation: 'əlíːvièit',
      pos: '동사',
      meaning: '완화하다; 경감시키다',
      example_sentence: 'A warm bath can help alleviate stress and muscle pain.',
      example_translation: '따뜻한 목욕은 스트레스와 근육통을 완화하는 데 도움을 줄 수 있다.',
      is_idiom: false,
      is_spelling_priority: true
    },
    {
      id: 'w-15-7',
      wordbook_id: 'wb-wm-day15',
      word: 'resilient',
      pronunciation: 'rizíljənt',
      pos: '형용사',
      meaning: '회복력 있는; 탄력 있는; 시련에 강한',
      example_sentence: 'Children are remarkably resilient when facing hardship.',
      example_translation: '아이들은 어려움에 직면했을 때 놀라울 정도로 회복력이 있다.',
      is_idiom: false,
      is_spelling_priority: false
    },
    {
      id: 'w-15-8',
      wordbook_id: 'wb-wm-day15',
      word: 'collaborate',
      pronunciation: 'kələ́bərèit',
      pos: '동사',
      meaning: '협력하다; 공동으로 작업하다',
      example_sentence: 'The two research teams decided to collaborate on the AI project.',
      example_translation: '두 연구 팀은 AI 프로젝트에서 협력하기로 결정했다.',
      is_idiom: false,
      is_spelling_priority: false
    },
    {
      id: 'w-15-9',
      wordbook_id: 'wb-wm-day15',
      word: 'inevitable',
      pronunciation: 'inévətəbl',
      pos: '형용사',
      meaning: '피할 수 없는; 불가피한',
      example_sentence: 'Change is an inevitable part of life.',
      example_translation: '변화는 인생의 피할 수 없는 일부이다.',
      is_idiom: false,
      is_spelling_priority: true
    },
    {
      id: 'w-15-10',
      wordbook_id: 'wb-wm-day15',
      word: 'eloquent',
      pronunciation: 'éləkwənt',
      pos: '형용사',
      meaning: '웅변의; 유창한; 표현력이 풍부한',
      example_sentence: 'His eloquent speech inspired everyone in the auditorium.',
      example_translation: '그의 유창한 연설은 강당에 있는 모든 사람에게 영감을 주었다.',
      is_idiom: false,
      is_spelling_priority: false
    }
  ],
  'wb-wm-day16': [
    {
      id: 'w-16-1',
      wordbook_id: 'wb-wm-day16',
      word: 'pragmatic',
      pronunciation: 'præɡmætɪk',
      pos: '형용사',
      meaning: '실용적인; 실제적인',
      example_sentence: 'We need a pragmatic approach to solve this complex problem.',
      example_translation: '이 복잡한 문제를 해결하기 위해서는 실용적인 접근법이 필요하다.',
      is_idiom: false,
      is_spelling_priority: true
    },
    {
      id: 'w-16-2',
      wordbook_id: 'wb-wm-day16',
      word: 'unprecedented',
      pronunciation: 'ʌnprésədèntid',
      pos: '형용사',
      meaning: '전례 없는; 공전의',
      example_sentence: 'The tech market experienced unprecedented growth last quarter.',
      example_translation: '기술 시장은 지난 분기에 전례 없는 성장을 경험했다.',
      is_idiom: false,
      is_spelling_priority: true
    },
    {
      id: 'w-16-3',
      wordbook_id: 'wb-wm-day16',
      word: 'redundant',
      pronunciation: 'ridʌ́ndənt',
      pos: '형용사',
      meaning: '불필요한; 장황한; 불필요하게 중복된',
      example_sentence: 'Removing redundant code made the app much faster.',
      example_translation: '중복된 코드를 제거하자 앱이 훨씬 빨라졌다.',
      is_idiom: false,
      is_spelling_priority: false
    },
    {
      id: 'w-16-4',
      wordbook_id: 'wb-wm-day16',
      word: 'spontaneous',
      pronunciation: 'spɑːntéiniəs',
      pos: '형용사',
      meaning: '자발적인; 즉흥적인; 구김살 없는',
      example_sentence: 'The audience broke into spontaneous applause.',
      example_translation: '청중은 즉흥적인 박수를 터뜨렸다.',
      is_idiom: false,
      is_spelling_priority: true
    },
    {
      id: 'w-16-5',
      wordbook_id: 'wb-wm-day16',
      word: 'substantial',
      pronunciation: 'səbstǽnʃəl',
      pos: '형용사',
      meaning: '상당한; 실질적인; 튼튼한',
      example_sentence: 'There was a substantial increase in student test scores.',
      example_translation: '학생 시험 점수에 상당한 향상이 있었다.',
      is_idiom: false,
      is_spelling_priority: false
    },
    {
      id: 'w-16-6',
      wordbook_id: 'wb-wm-day16',
      word: 'advocate',
      pronunciation: 'ǽdvəkèit',
      pos: '동사; 명사',
      meaning: '지지하다; 옹호하다; 지지자',
      example_sentence: 'She has long advocated for equal educational opportunities.',
      example_translation: '그녀는 오랫동안 평등한 교육 기회를 지지해 왔다.',
      is_idiom: false,
      is_spelling_priority: true
    },
    {
      id: 'w-16-7',
      wordbook_id: 'wb-wm-day16',
      word: 'comprehend',
      pronunciation: 'kɑ̀ːmprihénd',
      pos: '동사',
      meaning: '이해하다; 파악하다; 포함하다',
      example_sentence: 'It took me a while to comprehend the full scale of the news.',
      example_translation: '뉴스 전체의 규모를 이해하는 데 시간이 좀 걸렸다.',
      is_idiom: false,
      is_spelling_priority: false
    },
    {
      id: 'w-16-8',
      wordbook_id: 'wb-wm-day16',
      word: 'diligent',
      pronunciation: 'dílədʒənt',
      pos: '형용사',
      meaning: '근면한; 부지런한; 성실한',
      example_sentence: 'His diligent preparation paid off with a perfect score.',
      example_translation: '그의 성실한 준비는 만점으로 결실을 맺었다.',
      is_idiom: false,
      is_spelling_priority: true
    }
  ],
  'wb-csat-idiom': [
    {
      id: 'w-idm-1',
      wordbook_id: 'wb-csat-idiom',
      word: 'come up with',
      pronunciation: 'kʌm ʌp wɪð',
      pos: '숙어',
      meaning: '(아이디어·해답 등을) 떠올리다; 제안하다',
      example_sentence: 'He came up with a brilliant solution to the problem.',
      example_translation: '그는 문제에 대한 명쾌한 해결책을 떠올렸다.',
      is_idiom: true,
      is_spelling_priority: true
    },
    {
      id: 'w-idm-2',
      wordbook_id: 'wb-csat-idiom',
      word: 'take advantage of',
      pronunciation: 'teɪk ədˈvæntɪdʒ ʌv',
      pos: '숙어',
      meaning: '~을 이용하다; 기회로 활용하다',
      example_sentence: 'You should take advantage of this study opportunity.',
      example_translation: '당신은 이 학습 기회를 잘 활용해야 한다.',
      is_idiom: true,
      is_spelling_priority: true
    },
    {
      id: 'w-idm-3',
      wordbook_id: 'wb-csat-idiom',
      word: 'bring about',
      pronunciation: 'brɪŋ əˈbaʊt',
      pos: '숙어',
      meaning: '~을 야기하다; 초래하다',
      example_sentence: 'New technology will bring about significant changes in education.',
      example_translation: '새로운 기술은 교육 분야에 상당한 변화를 초래할 것이다.',
      is_idiom: true,
      is_spelling_priority: false
    },
    {
      id: 'w-idm-4',
      wordbook_id: 'wb-csat-idiom',
      word: 'put off',
      pronunciation: 'pʊt ɔːf',
      pos: '숙어',
      meaning: '미루다; 연기하다',
      example_sentence: 'Never put off until tomorrow what you can do today.',
      example_translation: '오늘 할 수 있는 일을 내일로 미루지 마라.',
      is_idiom: true,
      is_spelling_priority: true
    },
    {
      id: 'w-idm-5',
      wordbook_id: 'wb-csat-idiom',
      word: 'make dynamic progress',
      pronunciation: 'meɪk daɪˈnæmɪk ˈprɒɡrɛs',
      pos: '숙어',
      meaning: '역동적인 진전을 이루다',
      example_sentence: 'The student made dynamic progress after consistent vocabulary practice.',
      example_translation: '그 학생은 지속적인 단어 연습 후 역동적인 진전을 이루었다.',
      is_idiom: true,
      is_spelling_priority: false
    },
    {
      id: 'w-idm-6',
      wordbook_id: 'wb-csat-idiom',
      word: 'keep up with',
      pronunciation: 'kiːp ʌp wɪð',
      pos: '숙어',
      meaning: '~을 따라잡다; 최신 상태를 유지하다',
      example_sentence: 'It is essential to keep up with current English trends.',
      example_translation: '최신 영어 트렌드를 따라잡는 것이 중요하다.',
      is_idiom: true,
      is_spelling_priority: true
    }
  ]
};
