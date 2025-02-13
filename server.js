import { randomUUID } from 'crypto';
import fs from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';

import express from 'express';

const app = express();
const port = 3000;
const __dirname = path.resolve();

app.use(express.json());

// 특정한 날짜를 처리하는 함수
const adjustDate = (date, repeatType) => {
  const d = new Date(date);
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();

  // 월말 날짜(28일 이후) 처리
  if (day > 28) {
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    if (day > lastDayOfMonth) {
      d.setDate(lastDayOfMonth);
    }
  }
  return d;
};

// 반복 일정 endDate 기본값
const getDefaultEndDate = (startDate) => {
  const defaultEnd = new Date(startDate);
  defaultEnd.setMonth(defaultEnd.getMonth() + 1); // 기본값 1개월 후로 설정
  return defaultEnd;
};

// JSON 파일에서 이벤트 데이터 읽어오는 함수
const getEvents = async () => {
  const data = await readFile(`${__dirname}/src/__mocks__/response/realEvents.json`, 'utf8');

  return JSON.parse(data);
};

// 이벤트 데이터 저장하는 함수
const saveEvents = (events) => {
  fs.writeFileSync(
    `${__dirname}/src/__mocks__/response/realEvents.json`,
    JSON.stringify(events, null, 2)
  );
};

// 다음 날짜 계산 함수
const calculateNextDate = (currentDate, repeat) => {
  let nextDate = new Date(currentDate);

  switch (repeat.type) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + repeat.interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7 * repeat.interval);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + repeat.interval);
      nextDate = adjustDate(nextDate, 'monthly');
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + repeat.interval);
      nextDate = adjustDate(nextDate, 'yearly');
      break;
  }

  return nextDate;
};

// 모든 이벤트 조회 API
app.get('/api/events', async (_, res) => {
  const events = await getEvents();
  res.json(events);
});

// 새로운 이벤트 생성 API
app.post('/api/events', async (req, res) => {
  const events = await getEvents();
  const newEvent = { id: randomUUID(), ...req.body };

  // 반복 일정인 경우
  if (newEvent.repeat.type !== 'none') {
    const repeatId = randomUUID(); // 반복 일정 그룹화를 위한 ID
    const startDate = new Date(newEvent.date);
    const endDate = newEvent.repeat.endDate
      ? new Date(newEvent.repeat.endDate)
      : getDefaultEndDate(startDate);
    const recurringEvents = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // 주간 반복인 경우 요일 체크
      if (newEvent.repeat.type === 'weekly' && newEvent.repeat.weekdays?.length > 0) {
        if (newEvent.repeat.weekdays.includes(currentDate.getDay())) {
          recurringEvents.push({
            ...newEvent,
            id: randomUUID(),
            date: currentDate.toISOString().split('T')[0],
            repeat: {
              ...newEvent.repeat,
              id: repeatId, // 반복 일정 그룹 ID
            },
          });
        }
      } else {
        recurringEvents.push({
          ...newEvent,
          id: randomUUID(),
          date: currentDate.toISOString().split('T')[0],
          repeat: {
            ...newEvent.repeat,
            id: repeatId, // 반복 일정 그룹 ID
          },
        });
      }

      // 다음 날짜 계산
      currentDate = calculateNextDate(currentDate, newEvent.repeat);
      // switch (newEvent.repeat.type) {
      //   case 'daily':
      //     currentDate.setDate(currentDate.getDate() + newEvent.repeat.interval);
      //     break;
      //   case 'weekly':
      //     currentDate.setDate(currentDate.getDate() + 7 * newEvent.repeat.interval);
      //     break;
      //   case 'monthly':
      //     currentDate.setMonth(currentDate.getMonth() + newEvent.repeat.interval);
      //     currentDate = adjustDate(currentDate, 'monthly');
      //     break;
      //   case 'yearly':
      //     currentDate.setFullYear(currentDate.getFullYear() + newEvent.repeat.interval);
      //     currentDate = adjustDate(currentDate, 'yearly');
      //     break;
      // }
    }

    const updatedEvents = {
      events: [...events.events, ...recurringEvents],
    };
    saveEvents(updatedEvents);
    res.status(201).json(recurringEvents[0]);
  } else {
    // 단일 일정인 경우
    const updatedEvents = {
      events: [...events.events, newEvent],
    };
    saveEvents(updatedEvents);
    res.status(201).json(newEvent);
  }
});

// 이벤트 수정 API
app.put('/api/events/:id', async (req, res) => {
  const events = await getEvents();
  const id = req.params.id;
  const event = events.events.find((e) => e.id === id);
  const { updateType = 'single' } = req.query;

  if (!event) {
    return res.status(404).send('Event not found');
  }

  let updatedEvents = [...events.events];
  const repeatId = event.repeat?.id;

  if (repeatId && updateType !== 'single') {
    const eventDate = new Date(event.date);

    // 먼저 기존의 반복 일정 제거
    if (updateType === 'future') {
      // 현재 일정 포함 이후 일정만 제거
      updatedEvents = updatedEvents.filter(
        (e) => !(e.repeat?.id === repeatId && new Date(e.date) >= eventDate)
      );
    } else if (updateType === 'all') {
      // 모든 반복 일정 제거
      updatedEvents = updatedEvents.filter((e) => e.repeat?.id !== repeatId);
    }

    // 새로운 반복 ID 생성
    const newRepeatId = randomUUID();
    const { repeat, ...eventData } = req.body;

    // 새로운 반복 일정 생성
    const startDate = updateType === 'future' ? eventDate : new Date(event.date);
    const endDate = new Date(repeat.endDate || getDefaultEndDate(startDate));
    let currentDate = new Date(startDate);

    // 새로운 반복 일정 추가
    while (currentDate <= endDate) {
      if (repeat.type === 'weekly' && repeat.weekdays?.length > 0) {
        if (repeat.weekdays.includes(currentDate.getDay())) {
          updatedEvents.push({
            ...eventData,
            id: randomUUID(),
            date: currentDate.toISOString().split('T')[0],
            repeat: {
              ...repeat,
              id: newRepeatId,
            },
          });
        }
      } else {
        // 주간 반복이 아닌 경우
        updatedEvents.push({
          ...eventData,
          id: randomUUID(),
          date: currentDate.toISOString().split('T')[0],
          repeat: {
            ...repeat,
            id: newRepeatId,
          },
        });
      }

      // 다음 날짜 계산
      currentDate = calculateNextDate(currentDate, repeat);
      // switch (repeat.type) {
      //   case 'daily':
      //     currentDate.setDate(currentDate.getDate() + repeat.interval);
      //     break;
      //   case 'weekly':
      //     currentDate.setDate(currentDate.getDate() + 7 * repeat.interval);
      //     break;
      //   case 'monthly':
      //     currentDate.setMonth(currentDate.getMonth() + repeat.interval);
      //     currentDate = adjustDate(currentDate, 'monthly');
      //     break;
      //   case 'yearly':
      //     currentDate.setFullYear(currentDate.getFullYear() + repeat.interval);
      //     currentDate = adjustDate(currentDate, 'yearly');
      //     break;
      // }
    }
  } else {
    // 단일 일정 수정
    const eventIndex = updatedEvents.findIndex((e) => e.id === id);
    if (eventIndex > -1) {
      updatedEvents[eventIndex] = {
        ...updatedEvents[eventIndex],
        ...req.body,
        repeat: { type: 'none', interval: 1 }, // 반복 설정 제거
      };
    }
  }

  const updatedEventData = {
    events: updatedEvents,
  };
  saveEvents(updatedEventData);

  res.json(updatedEvents.find((e) => e.id === id));
});

// 이벤트 삭제 API
app.delete('/api/events/:id', async (req, res) => {
  const events = await getEvents();
  const id = req.params.id;
  const event = events.events.find((e) => e.id === id);

  if (!event) {
    return res.status(404).send('Event not found');
  }

  const { deleteType = 'single' } = req.query;
  const repeatId = event.repeat?.id;
  let updatedEvents = [...events.events];

  if (repeatId && deleteType !== 'single') {
    if (deleteType === 'future') {
      // 현재 일정 이후의 모든 일정 삭제
      const eventDate = new Date(event.date);
      updatedEvents = updatedEvents.filter(
        (e) => !(e.repeat?.id === repeatId && new Date(e.date) >= eventDate)
      );
    } else if (deleteType === 'all') {
      // 모든 반복 일정 삭제
      updatedEvents = updatedEvents.filter((e) => e.repeat?.id !== repeatId);
    }
  } else {
    // 단일 일정 삭제
    updatedEvents = updatedEvents.filter((e) => e.id !== id);
  }

  const updatedEventData = {
    events: updatedEvents,
  };
  saveEvents(updatedEventData);
  res.status(204).send();
});

// 여러 이벤트 일괄 수정 API
app.put('/api/events-list', async (req, res) => {
  const events = await getEvents();
  let isUpdated = false;

  const newEvents = [...events.events];
  req.body.events.forEach((event) => {
    const eventIndex = events.events.findIndex((target) => target.id === event.id);
    if (eventIndex > -1) {
      isUpdated = true;
      newEvents[eventIndex] = { ...events.events[eventIndex], ...event };
    }
  });

  if (isUpdated) {
    const updatedEvents = {
      events: newEvents,
    };
    saveEvents(updatedEvents);
    res.json(newEvents);
  } else {
    res.status(404).send('Event not found');
  }
});

// 여러 이벤트 일괄 삭제 API
app.delete('/api/events-list', async (req, res) => {
  const events = await getEvents();
  const newEvents = events.events.filter((event) => !req.body.eventIds.includes(event.id));

  const updatedEvents = {
    events: newEvents,
  };
  saveEvents(updatedEvents);
  res.status(204).send();
});

// 서버 시작
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

/* 기존 server.js 내용 */

// import { randomUUID } from 'crypto';
// import fs from 'fs';
// import { readFile } from 'fs/promises';
// import path from 'path';

// import express from 'express';

// const app = express();
// const port = 3000;
// const __dirname = path.resolve();

// app.use(express.json());

// const getEvents = async () => {
//   const data = await readFile(`${__dirname}/src/__mocks__/response/realEvents.json`, 'utf8');

//   return JSON.parse(data);
// };

// app.get('/api/events', async (_, res) => {
//   const events = await getEvents();
//   res.json(events);
// });

// app.post('/api/events', async (req, res) => {
//   const events = await getEvents();
//   const newEvent = { id: randomUUID(), ...req.body };

//   fs.writeFileSync(
//     `${__dirname}/src/__mocks__/response/realEvents.json`,
//     JSON.stringify({
//       events: [...events.events, newEvent],
//     })
//   );

//   res.status(201).json(newEvent);
// });

// app.put('/api/events/:id', async (req, res) => {
//   const events = await getEvents();
//   const { id } = req.params;
//   const eventIndex = events.events.findIndex((event) => event.id === id);
//   if (eventIndex > -1) {
//     const newEvents = [...events.events];
//     newEvents[eventIndex] = { ...events.events[eventIndex], ...req.body };

//     fs.writeFileSync(
//       `${__dirname}/src/__mocks__/response/realEvents.json`,
//       JSON.stringify({
//         events: newEvents,
//       })
//     );

//     res.json(events.events[eventIndex]);
//   } else {
//     res.status(404).send('Event not found');
//   }
// });

// app.delete('/api/events/:id', async (req, res) => {
//   const events = await getEvents();
//   const { id } = req.params;

//   fs.writeFileSync(
//     `${__dirname}/src/__mocks__/response/realEvents.json`,
//     JSON.stringify({
//       events: events.events.filter((event) => event.id !== id),
//     })
//   );

//   res.status(204).send();
// });

// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });
