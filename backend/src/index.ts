import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const app = new Hono()

// Basic route
app.get('/', (c) => {
    return c.json({ message: 'Anime Updater API is running!' })
})

// Example with Zod validation
const createPostSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    content: z.string().min(10, "Content must be at least 10 characters"),
})

app.post('/posts', zValidator('json', createPostSchema), (c) => {
    const data = c.req.valid('json')
    return c.json({ success: true, post: data })
})

export default app