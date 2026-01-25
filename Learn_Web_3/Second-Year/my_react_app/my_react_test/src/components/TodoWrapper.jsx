import CreateForm from "./CreateForm";
import Todo from "./Todo";
import { useState } from "react";
function TodoWrapper() {
  const [todos, setTodos] = useState([
    {
      content: "學習1",
      id: Math.random(),
      isCompleted: false,
      isEditing: false,
    },
    {
      content: "學習2",
      id: Math.random(),
      isCompleted: false,
      isEditing: false,
    },
    {
      content: "學習3",
      id: Math.random(),
      isCompleted: false,
      isEditing: false,
    },
  ]);

  const addTodo = (content, isCompleted, isEditing) => {
    setTodos([
      ...todos,
      {
        content: content,
        id: Math.random(),
        isCompleted: isCompleted,
        isEditing: isEditing,
      },
    ]);
  };

  const deleteTodo = (id) => {
    setTodos(
      todos.filter((todo) => {
        return todo.id !== id;
      }),
    );
  };

  const toggleComplete = (id) => {
    setTodos(
      todos.map((todo) => {
        if (todo.id === id) {
          return { ...todo, isCompleted: !todo.isCompleted };
        }
        return todo;
      }),
    );
  };

  const toggleIsEditing = (id) => {
    setTodos(
      todos.map((todo) => {
        if (todo.id === id) {
          return { ...todo, isEditing: !todo.isEditing };
        }
        return todo;
      }),
    );
  };

  const editTodo = (id, newContent) => {
    setTodos(
      todos.map((todo) => {
        if (todo.id === id) {
          return { ...todo, content: newContent, isEditing: false };
        }
        return todo;
      }),
    );
  };
  return (
    <div className="wrapper">
      <h1>Todo List</h1>
      <CreateForm addTodo={addTodo} />
      {todos.map((todo, index) => (
        <Todo
          toggleComplete={toggleComplete}
          toggleIsEditing={toggleIsEditing}
          editTodo={editTodo}
          todo={todo}
          key={todo.id}
          deleteTodo={deleteTodo}
        />
      ))}
    </div>
  );
}

export default TodoWrapper;
