import {handleServerError} from 'common/utils/handle-server-error'
import {createSlice} from "@reduxjs/toolkit";
import {thunkTodo} from "features/TodolistsList/todolist/todolists-reducer";
import {appActions} from "app/app-reducer";
import {createAppAsyncThunk} from "common/utils/create-app-async-thunk";
import {handleAppError} from "common/utils/handle-app-error";
import {TaskPriorities, TaskStatuses} from "common/commonType";
import {taskAPI, TCreateTaskArgs, TDeleteTasks, TTask, TUpdateTaskArgs, TUpdateTaskModel} from "features/TodolistsList/tasks/taskAPI";


export type TasksStateType = {
    [key: string]: Array<TTask>
}
const initialState: TasksStateType = {}


const fetchTasks = createAppAsyncThunk<{ tasks: TTask[], todolistId: string }, string>
('task/fetchTasks', async (todolistId: string, thunkAPI) => {
    const {dispatch, rejectWithValue} = thunkAPI
    try {
        dispatch(appActions.setAppStatus({status: "loading"}))
        const res = await taskAPI.getTasks(todolistId)
        const tasks = res.data.items
        dispatch(appActions.setAppStatus({status: "succeeded"}))
        return {tasks, todolistId}
    } catch (e) {
        handleServerError(e, dispatch)
        return rejectWithValue(null)
    }
})

const addTask = createAppAsyncThunk<TTask, TCreateTaskArgs>(
    "task/addTask", async (args, thunkAPI) => {
        const {dispatch, rejectWithValue} = thunkAPI
        try {

            dispatch(appActions.setAppStatus({status: "loading"}))
            const res = await taskAPI.createTask(args)
            if (res.data.resultCode === 0) {
                const task = res.data.data.item
                dispatch(appActions.setAppStatus({status: "succeeded"}))
                return {...task}
            } else {
                handleAppError(res.data, dispatch);
                return rejectWithValue(null)
            }
        } catch (e) {
            handleServerError(e, dispatch)
            return rejectWithValue(null)
        }
    }
)


const updateTask = createAppAsyncThunk<TUpdateTaskArgs, {
    taskId: string, domainModel: TUpdateDomainTaskModel, todolistId: string
}>('task/updateTask', async (args, thunkAPI) => {
    const {dispatch, rejectWithValue, getState} = thunkAPI
    try {
        dispatch(appActions.setAppStatus({status: "loading"}))
        const state = getState()
        const task = state.tasks[args.todolistId].find(t => t.id === args.taskId)
        if (!task) {
            //throw new Error("task not found in the state");
            console.warn('task not found in the state')
            return rejectWithValue(null)
        }

        const apiModel: TUpdateTaskModel = {
            deadline: task.deadline,
            description: task.description,
            priority: task.priority,
            startDate: task.startDate,
            title: task.title,
            status: task.status,
            ...args.domainModel
        }

        const res = await taskAPI.updateTask({todolistId: args.todolistId, taskId: args.taskId, model: apiModel})

        if (res.data.resultCode === 0) {
            dispatch(appActions.setAppStatus({status: "succeeded"}))
            return {taskId: args.taskId, model: res.data.data.item, todolistId: args.todolistId}
        } else {
            handleAppError(res.data, dispatch);
            dispatch(appActions.setAppStatus({status: "failed"}))
            return rejectWithValue(null)
        }
    } catch (e) {
        handleServerError(e, dispatch)
        return rejectWithValue(null)
    }
})

const removeTask = createAppAsyncThunk<TDeleteTasks, TDeleteTasks>('task/removeTask', async (arg, thunkAPI) => {
    const {dispatch, rejectWithValue} = thunkAPI
    try {
        dispatch(appActions.setAppStatus({status: "loading"}))
        await taskAPI.deleteTask(arg)
        dispatch(appActions.setAppStatus({status: "succeeded"}))
        return arg
    } catch (e) {
        handleServerError(e, dispatch)
        return rejectWithValue(null)
    }
})


const slice = createSlice({
    name: 'task',
    initialState,
    reducers: {},
    extraReducers: builder => {
        builder.addCase(thunkTodo.fetchTodolists.fulfilled, (state, action) => {
            action.payload.forEach(t => state[t.id] = [])
        })
        builder.addCase(thunkTodo.addTodo.fulfilled, (state, action) => {
            if (action.payload.todolist.id) state[action.payload.todolist.id] = []
        })
        builder.addCase(thunkTodo.removeTodo.fulfilled, (state, action) => {
            delete state[action.payload.id]
        })
        builder.addCase(fetchTasks.fulfilled, (state, action) => {
            state[action.payload.todolistId] = action.payload.tasks
        })
        builder.addCase(addTask.fulfilled, (state, action) => {
            state[action.payload.todoListId].unshift(action.payload)
        })
        builder.addCase(updateTask.fulfilled, (state, action) => {
            const task = state[action.payload.todolistId]
            const index = task.findIndex(t => t.id === action.payload.taskId)
            if (index !== -1) task[index] = {...task[index], ...action.payload.model}
        })
        builder.addCase(removeTask.fulfilled, (state, action) => {
            const task = state[action.payload.todolistId]
            const index = task.findIndex(t => t.id === action.payload.taskId)
            task.splice(index, 1)
        })
    },
})
export const tasksReducer = slice.reducer

export const tasksThunks = {fetchTasks, addTask, updateTask, removeTask}


export type TUpdateDomainTaskModel = {
    title?: string
    description?: string
    status?: TaskStatuses
    priority?: TaskPriorities
    startDate?: string
    deadline?: string
}


