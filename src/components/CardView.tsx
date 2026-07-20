import { ImageCard } from './ImageCard'
import { LinkCard } from './LinkCard'
import { NoteCard, type CardTypeProps } from './NoteCard'
import { TodoCard } from './TodoCard'

/**
 * One switch, so BoardView renders a flat list without caring about types.
 * Board cards join in Tahap 6.
 */
export function CardView(props: CardTypeProps) {
  switch (props.card.type) {
    case 'note':
      return <NoteCard {...props} />
    case 'todo':
      return <TodoCard {...props} />
    case 'image':
      return <ImageCard {...props} />
    case 'link':
      return <LinkCard {...props} />
    case 'board':
      // Tahap 6. Render as a note so the row is at least visible, not lost.
      return <NoteCard {...props} />
  }
}
