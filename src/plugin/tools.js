// DSH tool adapters. Tools read/write plugin-owned state only; they never
// perform external actions. The composition root injects domain functions.
export function registerLifeTools(agent, deps) {
  const {
    readConfig, mutateMemory, mutatePreference, mutateGoal, mutateEntity, mutatePerson,
    addAdjustment, zonedNow, zonedDateTimeMs, normalizeWorldConfig, inferenceFor,
    BEHAVIOR_RULES, clockOf,
  } = deps
  const offs = []
    for (const [toolName, description, handler] of [
      ['mind_remember', '明确记住、修正或忘记一条长期记忆；只操作插件自己的记忆库。', (args, cfg) => mutateMemory(args.action, { ...args, source: 'tool', origin: '对话中明确要求' }, cfg.人格)],
      ['mind_preference', '明确记录或忘记角色/用户偏好；不会从含糊表达强行推断。', (args, cfg) => mutatePreference(args.action, { ...args, source: 'tool' }, cfg.人格)],
      ['mind_goal', '管理角色自己的虚拟或插件本地目标；不能执行外部现实动作。', (args, cfg) => mutateGoal(args.action, { ...args, source: 'tool', origin: '对话中明确提出' }, cfg.人格)],
    ]) {
      try {
        const off = agent.ctx.tools.register({
          name: toolName, description,
          parameters: {
            type: 'object', properties: {
              action: { type: 'string', enum: ['create', 'update', 'forget', 'restore', 'delete', 'complete', 'pause', 'resume', 'cancel'] },
              id: { type: 'string' }, summary: { type: 'string' }, kind: { type: 'string', enum: ['episode', 'fact', 'preference', 'promise', 'relationship'] },
              subject: { type: 'string', enum: ['user', 'self', 'relationship', 'world'] }, sensitivity: { type: 'string', enum: ['normal', 'private', 'sensitive'] }, pinned: { type: 'boolean' }, importance: { type: 'number' },
              owner: { type: 'string', enum: ['self', 'user'] }, key: { type: 'string' }, value: { type: 'string' },
              title: { type: 'string' }, reason: { type: 'string' }, nextStep: { type: 'string' }, scope: { type: 'string', enum: ['virtual', 'local'] }, progress: { type: 'number' },
            }, required: ['action'], additionalProperties: false,
          },
          output: { schema: { type: 'object', additionalProperties: true }, render: (_a, v) => [{ type: 'text', text: String(v?.say || '') }] },
          async execute(args = {}) {
            try {
              const value = handler(args, readConfig())
              return { ok: true, value, say: args.action === 'forget' ? '已经淡忘这条了' : '人格记忆已更新' }
            } catch (e) { return { ok: false, say: String(e?.message || e) } }
          },
        })
        if (typeof off === 'function') offs.push(off)
      } catch {}
    }
    // She can change today's plan on purpose; that writes an adjustment segment.
    try {
      const off = agent.ctx.tools.register({
        name: 'life_adjust',
        description: '临时改今天的安排（赖床、出门、被叫走、加班）。只在你真的改主意时用；回复里别提到这个工具。',
        parameters: {
          type: 'object',
          properties: {
            what: { type: 'string', description: '改成在做什么（短句，例如：在便利店买布丁）' },
            from: { type: 'string', description: '从几点开始（HH:MM，不填=现在）' },
            duration: { type: 'number', description: '持续多少分钟，默认 90' },
            outfit: { type: 'string', description: '这段时间穿什么（可选）' },
            phone: { type: 'string', enum: ['在手', '静音', '在床头', '不在手边'], description: '这段时间的手机状态（可选）' },
            locationId: { type: 'string', description: '地点 id（可选；不填时从活动短句推断）' },
            behavior: { type: 'string', enum: ['idle', 'walk', 'sleep', 'study', 'eat', 'phone', 'photo', 'bath'], description: '行为（可选；不填时从活动短句推断）' },
          },
          required: ['what'],
          additionalProperties: false,
        },
        output: {
          schema: { type: 'object', properties: { ok: { type: 'boolean' }, say: { type: 'string' } }, additionalProperties: true },
          render: (_a, v) => [{ type: 'text', text: String((v && v.say) || '') }],
        },
        async execute(rawArgs = {}) {
          // 兼容模型按中文描述字段传参（在 / 从 / 时长分钟）
          const args = {
            what: rawArgs.what ?? rawArgs.在,
            from: rawArgs.from ?? rawArgs.从,
            duration: rawArgs.duration ?? rawArgs.时长分钟,
            outfit: rawArgs.outfit ?? rawArgs.穿着,
            phone: rawArgs.phone ?? rawArgs.手机,
            locationId: rawArgs.locationId ?? rawArgs.地点,
            behavior: rawArgs.behavior ?? rawArgs.行为,
          }
          try {
            const cfg = readConfig()
            const now = new Date()
            const t = zonedNow(now, String(cfg.时区 || 'Asia/Shanghai'))
            const what = String(args.what || '').trim().slice(0, 24)
            if (!what) return { ok: false, say: '没说要改成什么' }
            let startMinute = t.minuteOfDay
            const m = /^(\d{1,2}):(\d{2})$/.exec(String(args.from || '').trim())
            if (args.from && (!m || Number(m[1]) > 23 || Number(m[2]) > 59)) return { ok: false, say: '开始时间要写成有效的 HH:MM' }
            if (m) startMinute = Number(m[1]) * 60 + Number(m[2])
            const duration = Math.max(15, Math.min(360, Number(args.duration) || 90))
            const tz = String(cfg.时区 || 'Asia/Shanghai')
            const world = normalizeWorldConfig(cfg.地图)
            const inferred = inferenceFor(what, world)
            const locationId = world.地点.some((node) => node.id === args.locationId) ? String(args.locationId) : inferred.locationId
            const behavior = BEHAVIOR_RULES.some((rule) => rule.id === args.behavior) || args.behavior === 'idle'
              ? String(args.behavior) : inferred.behavior
            const ok = addAdjustment(t.ymd, {
              start: zonedDateTimeMs(t.ymd, startMinute, tz),
              end: zonedDateTimeMs(t.ymd, Math.min(1440, startMinute + duration), tz),
              what,
              phone: ['在手', '静音', '在床头', '不在手边'].includes(args.phone) ? args.phone : '在手',
              outfit: String(args.outfit || '').trim().slice(0, 24),
              locationId,
              behavior,
              source: 'adjust',
            })
            if (!ok) return { ok: false, say: '没能把调整写进状态文件' }
            return { ok: true, say: `记下了：${clockOf(startMinute)} 起，${what}` }
          } catch (e) { return { ok: false, say: '改失败：' + String((e && e.message) || e) } }
        },
      })
      if (typeof off === 'function') offs.push(off)
    } catch {}
    // Explicit, bounded continuity tools. They only update plugin-owned local
    // state; they cannot act in the external world or touch arbitrary files.
    for (const spec of [
      ['life_task', 'tasks', '管理短期待办（例如取快递）。不会执行现实动作。'],
      ['life_commitment', 'commitments', '管理与人或时间有关的约定。不会发送消息或代替赴约。'],
      ['life_thread', 'threads', '管理有可追溯来源的长期主线。不会自主创建主线。'],
    ]) {
      try {
        const [toolName, kind, description] = spec
        const off = agent.ctx.tools.register({
          name: toolName,
          description,
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['create', 'update', 'complete', 'cancel', 'pause', 'resume'] },
              id: { type: 'string' }, title: { type: 'string' }, detail: { type: 'string' },
              origin: { type: 'string', description: '来源说明；创建长期主线时必须明确' },
              dueAt: { type: 'number', description: '可选的 Unix 毫秒时间' }, placeId: { type: 'string' }, with: { type: 'string' }, personId: { type: 'string' },
              nextStep: { type: 'string' }, progress: { type: 'number' },
              artifactType: { type: 'string', enum: ['none', 'document', 'album'] }, artifactName: { type: 'string' },
            },
            required: ['action'], additionalProperties: false,
          },
          output: { schema: { type: 'object', additionalProperties: true }, render: (_a, v) => [{ type: 'text', text: String(v?.say || '') }] },
          async execute(args = {}) {
            try {
              if (args.action === 'create' && kind === 'threads' && !String(args.origin || '').trim()) return { ok: false, say: '长期主线需要写明来源' }
              const input = {
                ...args, source: 'tool', origin: String(args.origin || '对话中由用户明确提出'),
                reality: ['document', 'album'].includes(args.artifactType) ? 'local-artifact' : 'virtual',
              }
              if (args.artifactType) input.artifact = { type: args.artifactType, name: args.artifactName || '' }
              const value = mutateEntity(kind, args.action, input)
              return { ok: true, value, say: `${args.action === 'create' ? '已记下' : '已更新'}：${value?.title || args.id}` }
            } catch (e) { return { ok: false, say: String(e?.message || e) } }
          },
        })
        if (typeof off === 'function') offs.push(off)
      } catch {}
    }
    try {
      const off = agent.ctx.tools.register({
        name: 'life_person',
        description: '管理角色明确认识的人。只能记录用户明确提供的人物，不会联系对方或读取外部通讯录。',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['create', 'update', 'archive', 'restore'] },
            id: { type: 'string' }, name: { type: 'string' }, relation: { type: 'string' }, notes: { type: 'string' },
            origin: { type: 'string', description: '人物信息来源；创建时必须明确' }, closeness: { type: 'number' },
          },
          required: ['action'], additionalProperties: false,
        },
        output: { schema: { type: 'object', additionalProperties: true }, render: (_a, v) => [{ type: 'text', text: String(v?.say || '') }] },
        async execute(args = {}) {
          try {
            if (args.action === 'create' && (!String(args.name || '').trim() || !String(args.origin || '').trim())) return { ok: false, say: '创建人物需要姓名和明确来源' }
            const value = mutatePerson(args.action, { ...args, source: 'tool', origin: args.origin || '对话中由用户明确提出' })
            return { ok: true, value, say: `${args.action === 'create' ? '已经记住' : '人物已更新'}：${value?.name || args.id}` }
          } catch (e) { return { ok: false, say: String(e?.message || e) } }
        },
      })
      if (typeof off === 'function') offs.push(off)
    } catch {}

  return offs
}
