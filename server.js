import { randomUUID } from 'crypto';
import fs from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';

import express from 'express';

const app = express();
const port = 3000;
const __dirname = path.resolve();

app.use(express.json());

// 특정 날짜의 요일 확인하는 함수
const getDayofWeek = (date) => {
  return new Date(date).getDay();
};

// 날짜가 선택된 요일에 해당하는지 확인하는 함수
const isSelectedDay = (date, weekdays) => {
  const dayOfWeek = getDayofWeek(date);
  return weekdays.includes(dayOfWeek)
};

// 특정한 날짜를 처리하는 함수
const adjustDate = (date, repeatType) => {
  const d = new Date(date);
  const dat = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();

  // 월말 날짜(28일 이후) 처리
  if (day > 28) {
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    if (dat > lastDayOfMonth) {
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

// 반복 일정 날짜 생성 함수
const generateRecurringDates = (event) => {
  const { date, repeat } = event;
  const startDate = new Date(date);
  const endDate = repeat.endDate ? new Date(repeat.endDate) : getDefaultEndDate(startDate);
  const dates = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // 요일 지정이 있는 경우 해당 요일에만 일정 생성
    if (!repeat.weekdays || isSelectedDay(currentDate, repeat.weekdays)) {
      dates.push(new Date(currentDate));
    }

    switch (repeat.type) {
      case "daily":
        currentDate.setDate(currentDate.getDate() + repeat.interval);
        break;
      case "weekly":
        currentDate.setDate(currentDate.getDate() + (7 * repeat.interval));
        break;
      case "monthly":
        currentDate.setMonth(currentDate.getDate() + repeat.interval);
        currentDate = adjustDate(currentDate, "monthly");
        break;
      case "yearly":
        currentDate.setFullYear(currentDate.getFullYear() + repeat.interval);
        currentDate = adjustDate(currentDate, "yearly");
        break;
      default:
        break;
    }
  }

  return dates;
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

// 모든 이벤트 조회 API
app.get('/api/events', async (_, res) => {
  const events = await getEvents();
  res.json(events);
});

// 새로운 이벤트 생성 API
app.post('/api/events', async (req, res) => {
  const events = await getEvents();
  const newEvent = { id: randomUUID(), ...req.body };

  fs.writeFileSync(
    `${__dirname}/src/__mocks__/response/realEvents.json`,
    JSON.stringify({
      events: [...events.events, newEvent],
    })
  );

  res.status(201).json(newEvent);
});

// 이벤트 수정 API
app.put('/api/events/:id', async (req, res) => {
  const events = await getEvents();
  const id = req.params.id;
  const eventIndex = events.events.findIndex((event) => event.id === id);
  if (eventIndex > -1) {
    const newEvents = [...events.events];
    newEvents[eventIndex] = { ...events.events[eventIndex], ...req.body };

    fs.writeFileSync(
      `${__dirname}/src/__mocks__/response/realEvents.json`,
      JSON.stringify({
        events: newEvents,
      })
    );

    res.json(events.events[eventIndex]);
  } else {
    res.status(404).send('Event not found');
  }
});

// 이벤트 삭제 API
app.delete('/api/events/:id', async (req, res) => {
  const events = await getEvents();
  const id = req.params.id;

  fs.writeFileSync(
    `${__dirname}/src/__mocks__/response/realEvents.json`,
    JSON.stringify({
      events: events.events.filter((event) => event.id !== id),
    })
  );

  res.status(204).send();
});

// 여러 이벤트 일괄 생성 API
app.post('/api/events-list', async (req, res) => {
  const events = await getEvents();
  const repeatId = randomUUID();
  const newEvents = req.body.events.map((event) => {
    const isRepeatEvent = event.repeat.type !== 'none';
    return {
      id: randomUUID(),
      ...event,
      repeat: {
        ...event.repeat,
        id: isRepeatEvent ? repeatId : undefined,
      },
    };
  });

  fs.writeFileSync(
    `${__dirname}/src/__mocks__/response/realEvents.json`,
    JSON.stringify({
      events: [...events.events, ...newEvents],
    })
  );

  res.status(201).json(newEvents);
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
    fs.writeFileSync(
      `${__dirname}/src/__mocks__/response/realEvents.json`,
      JSON.stringify({
        events: newEvents,
      })
    );

    res.json(events.events);
  } else {
    res.status(404).send('Event not found');
  }
});

// 여러 이벤트 일괄 삭제 API
app.delete('/api/events-list', async (req, res) => {
  const events = await getEvents();
  const newEvents = events.events.filter((event) => !req.body.eventIds.includes(event.id)); // ? ids를 전달하면 해당 아이디를 기준으로 events에서 제거

  fs.writeFileSync(
    `${__dirname}/src/__mocks__/response/realEvents.json`,
    JSON.stringify({
      events: newEvents,
    })
  );

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