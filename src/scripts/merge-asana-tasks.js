const asana = require('../asana')
const moment = require('moment')

async function merge() {
  let templateTasks = await asana.request('GET', 'projects/328644071656607/tasks', {
    params: {
      opt_fields: 'tags,memberships,name,assignee,notes,due_on'
    }
  })
  templateTasks = templateTasks.data.data
  const projects = await asana.request('GET', 'projects', {
    params: { team: 328557368270312 }
  })
  const excludeProjects = [
  'Campaign Management',
  '[TEMPLATE] New Campaign'
  ]
  const projectsToMerge = projects.data.data.filter((project) => excludeProjects.indexOf(project.name) === -1)
  for (projectIndex = 0; projectIndex < projectsToMerge.length; projectIndex++) {
    const project = projectsToMerge[projectIndex]
    const tasks = await asana.requestList('GET', 'tasks', {
      params: {
        project: project.id,
        opt_fields: 'tags,memberships,name,assignee,notes,due_on'
      }
    })
    const tasksToAdd = []
    const tasksToDelete = []
    const tasksHash = {}
    let index = 0

    for (let index = 0; index < tasks.length; index++) {
      const task = tasks[index]
      const tags = task.tags.map((t) => t.id)
      if (tags.indexOf(336800528466913) === -1) {
        continue
      }

      tasksHash[task.name] = task
      var templateIndex = 0
      for (templateIndex = 0; templateIndex < templateTasks.length; templateIndex++) {
        const templateTask = templateTasks[templateIndex]
        if (task.name === templateTask.name) {       
          break
        }      
      }
      if (templateIndex === templateTasks.length) {
        tasksToDelete.push(task)
      }
    }

    for (let index = 0; index < templateTasks.length; index++) {
      const templateTask = templateTasks[index]
      if (!tasksHash[templateTask.name] && templateTask.name[templateTask.name.length-1] !== ':') {
        tasksToAdd.push(templateTask)
      } else {
        const task = tasksHash[templateTask.name]
        if (task) {
          const updateFields = {}
          if (task.notes === null && task.notes !== templateTask.notes) {
            updateFields['notes'] = templateTask.notes
          }
          if (Object.keys(updateFields).length > 0) {
            console.log('Updating fields', updateFields)
            await asana.request('PUT', `tasks/${task.id}`, {
              data: {
                data: updateFields
              }
            })
          }
        }
      }
    }

    for (let index = 0; index < tasksToAdd.length; index++) {      
      const deadline = tasksToAdd[index].due_on !== null ? moment(tasksToAdd[index].due_on).format('YYYY-MM-DD') : null
      console.log(deadline)
      await asana.request('POST', 'tasks', {
        data: {
          data: {
            name: tasksToAdd[index].name,
            projects: [project.id],
            tags: [336800528466913],
            assignee: tasksToAdd[index].assignee ? tasksToAdd[index].assignee.id : null,
            due_on: deadline,
            notes: tasksToAdd[index].notes
          }
        }
      })
    }
    for (let index = 0; index < tasksToDelete.length; index++) {
      await asana.request('DELETE', `tasks/${tasksToDelete[index].id}`)
    }
  }
}

merge().catch((ex) => console.log(ex))
