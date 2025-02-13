import { vi, beforeEach, afterEach } from 'vitest';
import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, within, act } from '@testing-library/react';
import { UserEvent, userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ReactElement } from 'react';

import {
  setupMockHandlerCreation,
  setupMockHandlerDeletion,
  setupMockHandlerUpdating,
} from '../__mocks__/handlersUtils';
import App from '../App';
import { server } from '../setupTests';
import { Event } from '../types';

// ! Hard 여기 제공 안함
const setup = (element: ReactElement) => {
  const user = userEvent.setup();

  return { ...render(<ChakraProvider>{element}</ChakraProvider>), user }; // ? Med: 왜 ChakraProvider로 감싸는지 물어보자
};

// ! Hard 여기 제공 안함
const saveSchedule = async (
  user: UserEvent,
  form: Omit<Event, 'id' | 'notificationTime' | 'repeat'>
) => {
  const { title, date, startTime, endTime, location, description, category } = form;

  await user.click(screen.getByRole('button', { name: '일정 추가' }));

  // 작은 지연 추가
  await new Promise(resolve => setTimeout(resolve, 0));
  
  // 일반 텍스트 입력
  await user.type(screen.getByRole('textbox', { name: '제목'}), title);
  await user.type(screen.getByRole('textbox', { name: '설명' }), description);
  await user.type(screen.getByRole('textbox', { name: '위치' }), location);

  // date와 time 타입 입력 - 정규식 사용
  await user.type(screen.getByLabelText(/날짜\s*\*/), date);
  await user.type(screen.getByLabelText(/시작 시간\s*\*/), startTime);
  await user.type(screen.getByLabelText(/종료 시간\s*\*/), endTime);

  // select 입력
  await user.selectOptions(screen.getByRole('combobox', { name: '카테고리 선택' }), category);

  await user.click(screen.getByTestId('event-submit-button'));
};

// 반복 일정 생성 함수
const saveRepeatSchedule = async (
  user: UserEvent,
  form: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    description: string;
    location: string;
    category: string;
    repeatType: string;
    repeatInterval: number;
    repeatEndDate?: string;
    repeatWeekdays?: number[];
  }
) => {
  const { 
    title, date, startTime, endTime, 
    description, location, category, 
    repeatType, repeatInterval, 
    repeatEndDate, repeatWeekdays 
  } = form;

  await act(async () => {
    await user.click(screen.getByRole('button', { name: '일정 추가' }));

    // 일반 텍스트 입력
    await user.type(screen.getByRole('textbox', { name: '제목'}), title);
    await user.type(screen.getByRole('textbox', { name: '설명' }), description);
    await user.type(screen.getByRole('textbox', { name: '위치' }), location);
  });
  
  // 날짜와 시간 입력
  await user.type(screen.getByLabelText(/날짜\s*\*/), date);
  await user.type(screen.getByLabelText(/시작 시간\s*\*/), startTime);
  await user.type(screen.getByLabelText(/종료 시간\s*\*/), endTime);

  // 카테고리 선택
  await user.selectOptions(screen.getByRole('combobox', { name: '카테고리 선택' }), category);

  // 반복 설정
  await user.click(screen.getByTestId('repeat-schedule-checkbox'));

  await user.selectOptions(
    screen.getByRole('combobox', { name: '반복 유형' }), 
    repeatType
  );

  // 추가 반복 설정
  if (repeatInterval > 1) {
    const intervalInput = screen.getByRole('spinbutton', { name: '반복 간격' });
    await user.clear(intervalInput);
    await user.type(intervalInput, repeatInterval.toString());
  }

  // 반복 종료일 설정
  if (repeatEndDate) {
    const endDateInput = screen.getByLabelText('반복 종료일');
    await user.type(endDateInput, repeatEndDate);
  }

  // 주간 반복 요일 설정
  if (repeatType === 'weekly' && repeatWeekdays) {
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    for (const dayIndex of repeatWeekdays) {
      // checkbox label을 이용해 찾기
      await user.click(screen.getByRole('checkbox', { name: weekDays[dayIndex] }));
    }
  }

  await user.click(screen.getByTestId('event-submit-button'));
};

describe('일정 CRUD 및 기본 기능', () => {
  it('입력한 새로운 일정 정보에 맞춰 모든 필드가 이벤트 리스트에 정확히 저장된다.', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);

    await saveSchedule(user, {
      title: '새 회의',
      date: '2024-10-15',
      startTime: '14:00',
      endTime: '15:00',
      description: '프로젝트 진행 상황 논의',
      location: '회의실 A',
      category: '업무',
    });

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('새 회의')).toBeInTheDocument();
    expect(eventList.getByText('2024-10-15')).toBeInTheDocument();
    expect(eventList.getByText('14:00 - 15:00')).toBeInTheDocument();
    expect(eventList.getByText('프로젝트 진행 상황 논의')).toBeInTheDocument();
    expect(eventList.getByText('회의실 A')).toBeInTheDocument();
    expect(eventList.getByText('카테고리: 업무')).toBeInTheDocument();
  });

  it('기존 일정의 세부 정보를 수정하고 변경사항이 정확히 반영된다', async () => {
    const { user } = setup(<App />);

    setupMockHandlerUpdating();

    await user.click(await screen.findByLabelText('Edit event'));

    // 일반 텍스트 입력 수정
    await user.clear(screen.getByRole('textbox', { name: '제목' }));
    await user.type(screen.getByRole('textbox', { name: '제목' }), '수정된 회의');
    await user.clear(screen.getByRole('textbox', { name: '설명' }));
    await user.type(screen.getByRole('textbox', { name: '설명' }), '회의 내용 변경');

    await user.click(screen.getByTestId('event-submit-button'));

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('수정된 회의')).toBeInTheDocument();
    expect(eventList.getByText('회의 내용 변경')).toBeInTheDocument();
  });

  it('일정을 삭제하고 더 이상 조회되지 않는지 확인한다', async () => {
    setupMockHandlerDeletion();

    const { user } = setup(<App />);
    const eventList = within(screen.getByTestId('event-list'));
    expect(await eventList.findByText('삭제할 이벤트')).toBeInTheDocument();

    // 삭제 버튼 클릭
    const allDeleteButton = await screen.findAllByLabelText('Delete event');
    await user.click(allDeleteButton[0]);
    
    expect(eventList.queryByText('삭제할 이벤트')).not.toBeInTheDocument();
  });
});

describe('일정 뷰', () => {
  it('주별 뷰를 선택 후 해당 주에 일정이 없으면, 일정이 표시되지 않는다.', async () => {
    // ! 현재 시스템 시간 2024-10-01
    const { user } = setup(<App />);

    await user.selectOptions(screen.getByLabelText('view'), 'week');

    // ! 일정 로딩 완료 후 테스트
    await screen.findByText('일정 로딩 완료!');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it('주별 뷰 선택 후 해당 일자에 일정이 존재한다면 해당 일정이 정확히 표시된다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);
    await saveSchedule(user, {
      title: '이번주 팀 회의',
      date: '2024-10-02',
      startTime: '09:00',
      endTime: '10:00',
      description: '이번주 팀 회의입니다.',
      location: '회의실 A',
      category: '업무',
    });

    await user.selectOptions(screen.getByLabelText('view'), 'week');

    const weekView = within(screen.getByTestId('week-view'));
    expect(weekView.getByText('이번주 팀 회의')).toBeInTheDocument();
  });

  it('월별 뷰에 일정이 없으면, 일정이 표시되지 않아야 한다.', async () => {
    vi.setSystemTime(new Date('2024-01-01'));

    setup(<App />);

    // ! 일정 로딩 완료 후 테스트
    await screen.findByText('일정 로딩 완료!');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it('월별 뷰에 일정이 정확히 표시되는지 확인한다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);
    await saveSchedule(user, {
      title: '이번달 팀 회의',
      date: '2024-10-02',
      startTime: '09:00',
      endTime: '10:00',
      description: '이번달 팀 회의입니다.',
      location: '회의실 A',
      category: '업무',
    });

    const monthView = within(screen.getByTestId('month-view'));
    expect(monthView.getByText('이번달 팀 회의')).toBeInTheDocument();
  });

  it('달력에 1월 1일(신정)이 공휴일로 표시되는지 확인한다', async () => {
    vi.setSystemTime(new Date('2024-01-01'));
    setup(<App />);

    const monthView = screen.getByTestId('month-view');

    // 1월 1일 셀 확인
    const januaryFirstCell = within(monthView).getByText('1').closest('td')!;
    expect(within(januaryFirstCell).getByText('신정')).toBeInTheDocument();
  });
});

describe('검색 기능', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/events', () => {
        return HttpResponse.json({
          events: [
            {
              id: 1,
              title: '팀 회의',
              date: '2024-10-15',
              startTime: '09:00',
              endTime: '10:00',
              description: '주간 팀 미팅',
              location: '회의실 A',
              category: '업무',
              repeat: { type: 'none', interval: 0 },
              notificationTime: 10,
            },
            {
              id: 2,
              title: '프로젝트 계획',
              date: '2024-10-16',
              startTime: '14:00',
              endTime: '15:00',
              description: '새 프로젝트 계획 수립',
              location: '회의실 B',
              category: '업무',
              repeat: { type: 'none', interval: 0 },
              notificationTime: 10,
            },
          ],
        });
      })
    );
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('검색 결과가 없으면, "검색 결과가 없습니다."가 표시되어야 한다.', async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '존재하지 않는 일정');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it("'팀 회의'를 검색하면 해당 제목을 가진 일정이 리스트에 노출된다", async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '팀 회의');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('팀 회의')).toBeInTheDocument();
  });

  it('검색어를 지우면 모든 일정이 다시 표시되어야 한다', async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '팀 회의');
    await user.clear(searchInput);

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('팀 회의')).toBeInTheDocument();
    expect(eventList.getByText('프로젝트 계획')).toBeInTheDocument();
  });
});

describe('일정 충돌', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('겹치는 시간에 새 일정을 추가할 때 경고가 표시된다', async () => {
    setupMockHandlerCreation([
      {
        id: '1',
        title: '기존 회의',
        date: '2024-10-15',
        startTime: '09:00',
        endTime: '10:00',
        description: '기존 팀 미팅',
        location: '회의실 B',
        category: '업무',
        repeat: { type: 'none', interval: 0 },
        notificationTime: 10,
      },
    ]);

    const { user } = setup(<App />);

    await saveSchedule(user, {
      title: '새 회의',
      date: '2024-10-15',
      startTime: '09:30',
      endTime: '10:30',
      description: '설명',
      location: '회의실 A',
      category: '업무',
    });

    expect(screen.getByText('일정 겹침 경고')).toBeInTheDocument();
    expect(screen.getByText(/다음 일정과 겹칩니다/)).toBeInTheDocument();
    expect(screen.getByText('기존 회의 (2024-10-15 09:00-10:00)')).toBeInTheDocument();
  });

  it('기존 일정의 시간을 수정하여 충돌이 발생하면 경고가 노출된다', async () => {
    setupMockHandlerUpdating();

    const { user } = setup(<App />);

    const editButton = (await screen.findAllByLabelText('Edit event'))[1];
    await user.click(editButton);

    // 시간 수정하여 다른 일정과 충돌 발생
    await user.clear(screen.getByLabelText(/시작 시간\s*\*/));
    await user.type(screen.getByLabelText(/시작 시간\s*\*/), '08:30');
    await user.clear(screen.getByLabelText(/종료 시간\s*\*/));
    await user.type(screen.getByLabelText(/종료 시간\s*\*/), '10:30');

    await user.click(screen.getByTestId('event-submit-button'));

    expect(screen.getByText('일정 겹침 경고')).toBeInTheDocument();
    expect(screen.getByText(/다음 일정과 겹칩니다/)).toBeInTheDocument();
    expect(screen.getByText('기존 회의 (2024-10-15 09:00-10:00)')).toBeInTheDocument();
  });
});

it('notificationTime을 10으로 하면 지정 시간 10분 전 알람 텍스트가 노출된다', async () => {
  vi.setSystemTime(new Date('2024-10-15 08:49:59'));

  setup(<App />);

  // ! 일정 로딩 완료 후 테스트
  await screen.findByText('일정 로딩 완료!');

  expect(screen.queryByText('10분 후 기존 회의 일정이 시작됩니다.')).not.toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(1000);
  });

  expect(screen.getByText('10분 후 기존 회의 일정이 시작됩니다.')).toBeInTheDocument();
});

describe('반복 일정 기능', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('반복 일정 생성시 반복 일정이 표시된다', async () => {
    setupMockHandlerCreation([]);

    const { user } = setup(<App />);

    await act(async () => {
      await saveRepeatSchedule(user, {
        title: '주간 팀 미팅',
        date: '2024-10-02',
        startTime: '09:00',
        endTime: '10:00',
        description: '매주 진행되는 팀 미팅',
        location: '회의실 A',
        category: '업무',
        repeatType: 'weekly',
        repeatInterval: 1,
        repeatEndDate: '2024-10-31',
        repeatWeekdays: [3], // 수요일만 선택
      });
    });
    
    // 토스트 메시지와 이벤트 생성 대기
    await act(async () => {
      await screen.findByText('일정이 추가되었습니다.');
    });

    await act(async () => {
      await user.selectOptions(screen.getByLabelText('view'), 'month');
    });

    // 로딩 기다리기
    await act(async () => null);

    // 데이터 검증
    const monthView = await screen.findByTestId('month-view');
    const cells = await within(monthView).findAllByRole('cell');
    // console.log('Cells content:', cells.map(cell => cell.textContent));

    const hasEventTitle = cells.some(cell => 
      cell.textContent?.includes('주간 팀 미팅')
    );

    expect(hasEventTitle).toBe(true);
  });

  it('반복 일정을 단일 수정하면 반복 아이콘이 사라진다', async () => {
    setupMockHandlerCreation([]);

    const { user } = setup(<App />);

    // 반복 일정 생성
    await act(async () => {
      await saveRepeatSchedule(user, {
        title: '주간 팀 미팅',
        date: '2024-10-02',
        startTime: '09:00',
        endTime: '10:00',
        description: '매주 진행되는 팀 미팅',
        location: '회의실 A',
        category: '업무',
        repeatType: 'weekly',
        repeatInterval: 1,
        repeatEndDate: '2024-10-31',
        repeatWeekdays: [3], // 수요일만 선택
      });
    });

    // 토스트 메시지 대기
    await act(async () => {
      await screen.findByText('일정이 추가되었습니다.');
    });

    // 뷰를 월별로 변경
    await user.selectOptions(screen.getByLabelText('view'), 'month');

    // 첫 번째 이벤트 수정
    const editButtons = await screen.findAllByLabelText('Edit event');
    await user.click(editButtons[0]);

    // 단일 일정 수정 라디오 버튼 선택
    const singleUpdateRadio = screen.getByTestId('radio-update-single');
    await user.click(singleUpdateRadio);

    // 확인 버튼 클릭
    const confirmButtons = screen.getAllByRole('button', { name: '확인' });
    await user.click(confirmButtons[0]);

    // 잠시 대기
    await act(async () => null);

    // 반복 아이콘 로깅
    const afterremainingRepeatIcons = screen.queryAllByTestId('repeat-icon');

    // 반복 아이콘 확인
    expect(afterremainingRepeatIcons.length).toBe(4); // 4
  });

  
  it('반복 일정 단일 삭제시 해당 일정만 삭제된다', async () => {
    setupMockHandlerCreation([]);

    const { user } = setup(<App />);

    // 반복 일정 생성
    await act(async () => {
      await saveRepeatSchedule(user, {
        title: '주간 팀 미팅',
        date: '2024-10-02',
        startTime: '09:00',
        endTime: '10:00',
        description: '매주 진행되는 팀 미팅',
        location: '회의실 A',
        category: '업무',
        repeatType: 'weekly',
        repeatInterval: 1,
        repeatEndDate: '2024-10-31',
        repeatWeekdays: [3], // 수요일만 선택
      });
    });

    // 토스트 메시지 대기
    await act(async () => {
      await screen.findByText('일정이 추가되었습니다.');
    });

    // 첫 번째 이벤트 삭제
    const deleteButtons = await screen.findAllByLabelText('Delete event');
    await user.click(deleteButtons[0]);

    // 단일 일정 삭제 라디오 버튼 선택
    const singleDeleteRadio = screen.getByTestId('radio-update-single');
    await user.click(singleDeleteRadio);

    // 확인 버튼 클릭
    const confirmButtons = screen.getAllByRole('button', { name: '확인' });
    await user.click(confirmButtons[0]);

    // 잠시 대기
    await act(async () => null);

    // 남은 이벤트 확인
    const events = screen.getAllByTestId('event-item');

    // 총 4개의 이벤트가 남아야 함
    expect(events.length).toBe(4);
  });

  it('윤년 2월 29일에 매월 반복 설정시 해당 월의 마지막 날에 일정이 생성된다', async () => {
    const mockEvents: Event[] = []; // mockEvents 추적
    setupMockHandlerCreation(mockEvents);

    const { user } = setup(<App />);

    vi.setSystemTime(new Date('2024-02-29'));

    // 윤년 2월 29일 반복 일정 생성
    await act(async () => {
      await saveRepeatSchedule(user, {
        title: '윤년 월말 일정',
        date: '2024-02-29',
        startTime: '09:00',
        endTime: '10:00',
        description: '윤년 월말 반복 일정',
        location: '회의실 A',
        category: '업무',
        repeatType: 'monthly',
        repeatInterval: 1,
        repeatEndDate: '2025-02-29'
      });
    });

    // 일정 추가 완료 메시지 대기
    await act(async () => {
      await screen.findByText('일정이 추가되었습니다.');
    });

    // 서버에서 생성된 이벤트 확인
    const response = await fetch('/api/events');
    const { events } = await response.json();
    
    // 기대되는 날짜들 (월말)
    const expectedDates = [
      '2024-02-29', 
      '2024-03-31', 
      '2024-04-30', 
      '2024-05-31', 
      '2024-06-30', 
      '2024-07-31', 
      '2024-08-31', 
      '2024-09-30', 
      '2024-10-31', 
      '2024-11-30', 
      '2024-12-31', 
      '2025-01-31'
    ];
    
    const monthlyEvents = events.filter((e: Event) => 
      e.title === '윤년 월말 일정' && 
      expectedDates.includes(e.date)
    );
  
    // 이벤트 개수 확인
    expect(monthlyEvents.length).toBe(expectedDates.length);
    
    // 각 월말 날짜 검증
    expectedDates.forEach(expectedDate => {
      const matchingEvent = monthlyEvents.find((e: Event) => e.date === expectedDate);
      expect(matchingEvent).toBeTruthy();
      expect(matchingEvent.title).toBe('윤년 월말 일정');
    });
    
    // 뷰를 월별로 변경
    await act(async () => {
      await user.selectOptions(screen.getByLabelText('view'), 'month');
    });

    // Previous 버튼 클릭하여 2024년 2월로 이동
    const prevButton = screen.getByLabelText('Previous');
    
    // 2024년 10월에서 2024년 2월까지 이동 (8번)
    for(let i = 0; i < 8; i++) {
      await act(async () => {
        await user.click(prevButton);
      });
    }

    // 각 월별로 확인
    for(const expectedDate of expectedDates) {
      // 월 및 날짜 분리
      const [, , day] = expectedDate.split('-');

      // 해당 월의 마지막 날 셀 찾기
      const monthView = await screen.findByTestId('month-view');
      const cells = await within(monthView).findAllByRole('cell');

      // 마지막 날 셀 찾기
      const lastDayCell = cells.find(cell => {
        const cellText = cell.textContent || '';
    
        // 여러 방식으로 날짜와 이벤트 매칭
        const matchesDay = 
          cellText.trim() === day || 
          cellText.startsWith(day) || 
          cellText.includes(day + '윤년 월말 일정') ||
          cellText.includes('윤년 월말 일정');

        return matchesDay;
      });
      
      if (lastDayCell) {
        expect(lastDayCell.textContent).toContain('윤년 월말 일정');
      }

      expect(lastDayCell).toBeTruthy();

      // 다음 달로 이동
      const nextButton = screen.getByLabelText('Next');
      await act(async () => {
        await user.click(nextButton);
      });
    }
  }, 10000);
});

