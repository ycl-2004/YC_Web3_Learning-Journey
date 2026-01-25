import { MdDelete, MdEdit } from "react-icons/md";
import EditForm from "./EditForm.jsx";

function Todo({ todo, deleteTodo, toggleComplete, toggleIsEditing, editTodo }) {
  return todo.isEditing ? (
    <EditForm
      todo={todo}
      toggleIsEditing={toggleIsEditing}
      editTodo={editTodo}
    />
  ) : (
    <div className={`todo ${todo.isCompleted ? "completed" : ""}`}>
      <p onClick={() => toggleComplete(todo.id)}>{todo.content}</p>
      <div>
        <MdEdit
          onClick={() => {
            toggleIsEditing(todo.id);
          }}
          style={{ cursor: "pointer" }}
        />
        <MdDelete
          onClick={() => {
            deleteTodo(todo.id);
          }}
          style={{ cursor: "pointer", marginLeft: "7px" }}
        />
      </div>
    </div>
  );
}

export default Todo;
