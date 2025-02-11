import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DeleteIcon,
  EditIcon,
  RepeatIcon,
} from '@chakra-ui/icons';
import {
  Alert,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useRef, useState } from 'react';

import { useCalendarView } from './hooks/useCalendarView.ts';
import { useEventForm } from './hooks/useEventForm.ts';
import { useEventOperations } from './hooks/useEventOperations.ts';
import { useNotifications } from './hooks/useNotifications.ts';
import { useSearch } from './hooks/useSearch.ts';
import { Event, EventForm, RepeatType } from './types';
import {
  formatDate,
  formatMonth,
  formatWeek,
  getEventsForDay,
  getWeekDates,
  getWeeksAtMonth,
} from './utils/dateUtils';
import { findOverlappingEvents } from './utils/eventOverlap';
import { getTimeErrorMessage } from './utils/timeValidation';

const categories = ['업무', '개인', '가족', '기타'];

const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

const notificationOptions = [
  { value: 1, label: '1분 전' },
  { value: 10, label: '10분 전' },
  { value: 60, label: '1시간 전' },
  { value: 120, label: '2시간 전' },
  { value: 1440, label: '1일 전' },
];

function App() {
  const {
    title,
    setTitle,
    date,
    setDate,
    startTime,
    endTime,
    description,
    setDescription,
    location,
    setLocation,
    category,
    setCategory,
    isRepeating,
    setIsRepeating,
    repeatType,
    setRepeatType,
    repeatInterval,
    setRepeatInterval,
    repeatEndDate,
    setRepeatEndDate,
    repeatWeekdays,
    setRepeatWeekdays,
    notificationTime,
    setNotificationTime,
    startTimeError,
    endTimeError,
    editingEvent,
    setEditingEvent,
    handleStartTimeChange,
    handleEndTimeChange,
    editEvent,
  } = useEventForm();

  const { events, saveEvent, deleteEvent } = useEventOperations(Boolean(editingEvent), () =>
    setEditingEvent(null)
  );

  const { notifications, notifiedEvents, setNotifications } = useNotifications(events);
  const { view, setView, currentDate, holidays, navigate } = useCalendarView();
  const { searchTerm, filteredEvents, setSearchTerm } = useSearch(events, currentDate, view);

  const [isOverlapDialogOpen, setIsOverlapDialogOpen] = useState(false);
  const [overlappingEvents, setOverlappingEvents] = useState<Event[]>([]);
  const [updateType, setUpdateType] = useState<'single' | 'future' | 'all'>('single');
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const toast = useToast();

  const addOrUpdateEvent = async (action: 'save' | 'delete', ignoreOverlap: boolean = false) => {
    if (action === 'save') {
      if (!title || !date || !startTime || !endTime) {
        toast({
          title: '필수 정보를 모두 입력해주세요.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      if (startTimeError || endTimeError) {
        toast({
          title: '시간 설정을 확인해주세요.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
  
      const eventData: Event | EventForm = {
        id: editingEvent ? editingEvent.id : undefined,
        title,
        date,
        startTime,
        endTime,
        description,
        location,
        category,
        repeat: {
          type: isRepeating ? repeatType : 'none',
          interval: repeatInterval,
          endDate: repeatEndDate || undefined,
          weekdays: repeatWeekdays,
        },
        notificationTime,
      };
  
      const overlapping = findOverlappingEvents(eventData, events);
      if (!ignoreOverlap && overlapping.length > 0) {
        setOverlappingEvents(overlapping);
        setIsOverlapDialogOpen(true);
        return
      }

      await saveEvent(eventData, editingEvent ? updateType : undefined);
        if (editingEvent && updateType === 'single') {
          const updatedEvent = {
            ...eventData,
            repeat: { type: 'none', interval: 1 } // 단일 일정으로 변경
          };
          editEvent(updatedEvent as Event); // 폼에 업데이트된 정보 설정
        }
        setIsUpdateDialogOpen(false);  
      
    } else if (action === 'delete' && selectedEventId) {
      await deleteEvent(selectedEventId, updateType);
      setIsDeleteDialogOpen(false);
      setSelectedEventId(null);
    }    
  };

  const renderEventDialog = (type: 'update' | 'delete') => {
    const isUpdate = type === 'update';
    const isOpen = isUpdate ? isUpdateDialogOpen : isDeleteDialogOpen;
    const title = isUpdate ? '일정 수정' : '일정 삭제';
    const description = isUpdate 
      ? '이 반복 일정을 어떻게 수정하시겠습니까?' 
      : '이 반복 일정을 어떻게 삭제하시겠습니까?';

    return (
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => {
          if (isUpdate) {
            setIsUpdateDialogOpen(false);
          } else {
            setIsDeleteDialogOpen(false);
          }
        }}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              {title}
            </AlertDialogHeader>

            <AlertDialogBody>
              <Text mb={4}>{description}</Text>
              <RadioGroup value={updateType} onChange={(value: 'single' | 'future' | 'all') => setUpdateType(value)}>
                <Stack direction="column">
                  <Radio value="single">이 일정만</Radio>
                  <Radio value="future">이 일정 및 향후 일정</Radio>
                  <Radio value="all">모든 반복 일정</Radio>
                </Stack>
              </RadioGroup>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => {
                if (isUpdate) {
                  setIsUpdateDialogOpen(false);
                } else {
                  setIsDeleteDialogOpen(false);
                }
              }}>
                취소
              </Button>
              <Button
                colorScheme={isUpdate ? 'blue' : 'red'}
                onClick={() => addOrUpdateEvent(isUpdate ? 'save' : 'delete')}
                ml={3}
              >
                확인
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    );
  };

  const renderEventForm = () => (
    <VStack w="400px" spacing={5} align="stretch">
      <Heading>{editingEvent ? '일정 수정' : '일정 추가'}</Heading>

      <FormControl isRequired>
        <FormLabel>제목</FormLabel>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </FormControl>

      <FormControl isRequired>
        <FormLabel>날짜</FormLabel>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </FormControl>

      <HStack width="100%">
        <FormControl isRequired>
          <FormLabel>시작 시간</FormLabel>
          <Tooltip label={startTimeError} isOpen={!!startTimeError} placement="top">
            <Input
              type="time"
              value={startTime}
              onChange={handleStartTimeChange}
              onBlur={() => getTimeErrorMessage(startTime, endTime)}
              isInvalid={!!startTimeError}
            />
          </Tooltip>
        </FormControl>
        <FormControl isRequired>
          <FormLabel>종료 시간</FormLabel>
          <Tooltip label={endTimeError} isOpen={!!endTimeError} placement="top">
            <Input
              type="time"
              value={endTime}
              onChange={handleEndTimeChange}
              onBlur={() => getTimeErrorMessage(startTime, endTime)}
              isInvalid={!!endTimeError}
            />
          </Tooltip>
        </FormControl>
      </HStack>

      <FormControl>
        <FormLabel>설명</FormLabel>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>위치</FormLabel>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel htmlFor="category">카테고리</FormLabel>
        <Select 
          id = "category" 
          aria-label = "카테고리 선택"
          value = {category} 
          onChange = {(e) => setCategory(e.target.value)}>
          <option value="">카테고리 선택</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>반복 설정</FormLabel>
        <Checkbox isChecked={isRepeating} onChange={(e) => setIsRepeating(e.target.checked)}>
          반복 일정
        </Checkbox>
      </FormControl>

      <FormControl>
        <FormLabel htmlFor="notification">알림 설정</FormLabel>
        <Select
          id="notification"
          aria-label="알림 설정"
          value={notificationTime}
          onChange={(e) => setNotificationTime(Number(e.target.value))}
        >
          {notificationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormControl>

      {isRepeating && (
        <VStack spacing={4}>
          <FormControl>
            <FormLabel htmlFor="repeat-type">반복 유형</FormLabel>
            <Select
              id="repeat-type"
              aria-label="반복 유형 설정"
              value={repeatType}
              onChange={(e) => setRepeatType(e.target.value as RepeatType)}
            >
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
              <option value="yearly">매년</option>
            </Select>
          </FormControl>

          {repeatType === 'weekly' && (
            <FormControl>
              <FormLabel>반복할 요일</FormLabel>
              <HStack wrap="wrap" spacing={4}>
                {weekDays.map((day, index) => (
                  <Checkbox
                    key={day}
                    isChecked={repeatWeekdays.includes(index)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setRepeatWeekdays([...repeatWeekdays, index]);
                      } else {
                        setRepeatWeekdays(repeatWeekdays.filter(d => d !== index));
                      }
                    }}
                  >
                    {day}
                  </Checkbox>
                ))}
              </HStack>
            </FormControl>
          )}

          <HStack width="100%">
            <FormControl>
              <FormLabel>반복 간격</FormLabel>
              <Input
                type="number"
                value={repeatInterval}
                onChange={(e) => setRepeatInterval(Number(e.target.value))}
                min={1}
              />
            </FormControl>
            <FormControl>
              <FormLabel>반복 종료일</FormLabel>
              <Input
                type="date"
                value={repeatEndDate}
                onChange={(e) => setRepeatEndDate(e.target.value)}
              />
            </FormControl>
          </HStack>
        </VStack>
      )}

      <Button
        data-testid="event-submit-button"
        onClick={() => addOrUpdateEvent('save')}
        colorScheme="blue"
      >
        {editingEvent ? '일정 수정' : '일정 추가'}
      </Button>
    </VStack>
  );

  const renderCalendarEvent = (event: Event, isCalendarView = true) => {
    const isNotified = notifiedEvents.includes(event.id);
    const isRepeating = event.repeat?.type !== 'none';
  
    return (
      <Box
        key={event.id}
        p={1}
        my={1}
        bg={isCalendarView ? 'blue.50' : 'white'}
        borderRadius="md"
        w="100%"
      >
        <HStack>
          {isNotified && <BellIcon color="red.500" />}
          {isRepeating && <RepeatIcon color="blue.500" />}
          <Text
            fontSize="sm"
            noOfLines={1}
            fontWeight={isNotified ? 'bold' : 'normal'}
            color={isNotified ? 'red.500' : 'inherit'}
          >
            {event.title}
          </Text>
        </HStack>
      </Box>
    );
  };
  
  const renderEvent = (event: Event) => {
    const isNotified = notifiedEvents.includes(event.id);
    const isRepeating = event.repeat?.type !== 'none';

    return (
      <Box
        key={`calendar-event-${event.id}`}
        p={4}
        my={2}
        bg='white'
        borderRadius='lg'
        borderWidth='1px'
        borderColor='gray.200'
        position='relative'
        w='100%'
      >
        <HStack justifyContent="space-between">
          <VStack align="start" spacing={1}>
            <HStack>
              {isNotified && <BellIcon color="red.500" />}
              {isRepeating && <RepeatIcon color="blue.500" />}
              <Text
                fontWeight={isNotified ? 'bold' : 'normal'}
                color={isNotified ? 'red.500' : 'inherit'}
              >
                {event.title}
              </Text>
            </HStack>
            <Text fontSize="sm">{event.date}</Text>
            <Text fontSize="sm">
              {event.startTime} - {event.endTime}
            </Text>
            {event.description && <Text fontSize="sm">{event.description}</Text>}
            {event.location && <Text fontSize="sm">{event.location}</Text>}
            <Text fontSize="sm">카테고리: {event.category}</Text>
            {isRepeating && (
              <Text fontSize="sm">
                반복: {event.repeat.interval}
                {event.repeat.type === 'daily' && '일'}
                {event.repeat.type === 'weekly' && '주'}
                {event.repeat.type === 'monthly' && '월'}
                {event.repeat.type === 'yearly' && '년'}
                마다
                {event.repeat.endDate && ` (종료: ${event.repeat.endDate})`}
              </Text>
            )}
          </VStack>
          <HStack>
            <IconButton
              aria-label="Edit event"
              icon={<EditIcon />}
              bg="gray.100"
              onClick={() => {
                editEvent(event);
                if (event.repeat?.type !== 'none') {
                  setIsUpdateDialogOpen(true);
                }
              }}
            />
            <IconButton
              aria-label="Delete event"
              icon={<DeleteIcon />}
              bg="gray.100"
              onClick={() => {
                setSelectedEventId(event.id);
                if (event.repeat?.type !== 'none') {
                  setIsDeleteDialogOpen(true);
                } else {
                  deleteEvent(event.id, 'single');
                }
              }}
            />
          </HStack>
        </HStack>
      </Box>
    );
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate);
    return (
      <VStack data-testid="week-view" align="stretch" w="full" spacing={4}>
        <Heading size="md">{formatWeek(currentDate)}</Heading>
        <Table variant="simple" w="full">
          <Thead>
            <Tr>
              {weekDays.map((day) => (
                <Th key={day} width="14.28%">
                  {day}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              {weekDates.map((date) => (
                <Td key={date.toISOString()} height="100px" verticalAlign="top" width="14.28%">
                  <Text fontWeight="bold">{date.getDate()}</Text>
                  {filteredEvents
                    .filter((event) => new Date(event.date).toDateString() === date.toDateString())
                    .map((event) => renderCalendarEvent(event, true))}
                </Td>
              ))}
            </Tr>
          </Tbody>
        </Table>
      </VStack>
    );
  };

  const renderMonthView = () => {
    const weeks = getWeeksAtMonth(currentDate);

    return (
      <VStack data-testid="month-view" align="stretch" w="full" spacing={4}>
        <Heading size="md">{formatMonth(currentDate)}</Heading>
        <Table variant="simple" w="full">
          <Thead>
            <Tr>
              {weekDays.map((day) => (
                <Th key={day} width="14.28%">
                  {day}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {weeks.map((week, weekIndex) => (
              <Tr key={weekIndex}>
                {week.map((day, dayIndex) => {
                  const dateString = day ? formatDate(currentDate, day) : '';
                  const holiday = holidays[dateString];

                  return (
                    <Td
                      key={dayIndex}
                      height="100px"
                      verticalAlign="top"
                      width="14.28%"
                      position="relative"
                    >
                      {day && (
                        <>
                          <Text fontWeight="bold">{day}</Text>
                          {holiday && (
                            <Text color="red.500" fontSize="sm">
                              {holiday}
                            </Text>
                          )}
                          {getEventsForDay(filteredEvents, day).map((event) => renderCalendarEvent(event, true))}
                        </>
                      )}
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </VStack>
    );
  };

  return (
    <Box w="full" h="100vh" m="auto" p={5}>
      <Flex gap={6} h="full">
        {renderEventForm()}

        <VStack flex={1} spacing={5} align="stretch">
          <Heading>일정 보기</Heading>

          <HStack mx="auto" justifyContent="space-between">
            <IconButton
              aria-label="Previous"
              icon={<ChevronLeftIcon />}
              onClick={() => navigate('prev')}
            />
            <Select
              id="calender-view"
              aria-label="view"
              value={view}
              onChange={(e) => setView(e.target.value as 'week' | 'month')}
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
            </Select>
            <IconButton
              aria-label="Next"
              icon={<ChevronRightIcon />}
              onClick={() => navigate('next')}
            />
          </HStack>

          {view === 'week' && renderWeekView()}
          {view === 'month' && renderMonthView()}
        </VStack>

        <VStack data-testid="event-list" w="500px" h="full" overflowY="auto">
          <FormControl>
            <FormLabel>일정 검색</FormLabel>
            <Input
              placeholder="검색어를 입력하세요"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </FormControl>

          {filteredEvents.length === 0 ? (
            <Text>검색 결과가 없습니다.</Text>
          ) : (
            filteredEvents.map((event) => renderEvent(event))
          )}
        </VStack>
      </Flex>

      {/* 반복 일정 관련 다이얼로그 */}
      {renderEventDialog('update')}
      {renderEventDialog('delete')}

      {/* 일정 중복 경고 다이얼로그 */}
      <AlertDialog
        isOpen={isOverlapDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsOverlapDialogOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              일정 겹침 경고
            </AlertDialogHeader>

            <AlertDialogBody>
              다음 일정과 겹칩니다:
              {overlappingEvents.map((event) => (
                <Text key={event.id}>
                  {event.title} ({event.date} {event.startTime}-{event.endTime})
                </Text>
              ))}
              계속 진행하시겠습니까?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsOverlapDialogOpen(false)}>
                취소
              </Button>
              <Button
                colorScheme="red"
                onClick={async () => {
                  await addOrUpdateEvent('save', true);
                  setIsOverlapDialogOpen(false);
                }}
                ml={3}
              >
                계속 진행
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* 알림 표시 */}
      {notifications.length > 0 && (
        <VStack position="fixed" top={4} right={4} spacing={2} align="flex-end">
          {notifications.map((notification, index) => (
            <Alert key={index} status="info" variant="solid" width="auto">
              <AlertIcon />
              <Box flex="1">
                <AlertTitle fontSize="sm">{notification.message}</AlertTitle>
              </Box>
              <CloseButton
                onClick={() => setNotifications((prev) => prev.filter((_, i) => i !== index))}
              />
            </Alert>
          ))}
        </VStack>
      )}
    </Box>
  );
}

export default App;
